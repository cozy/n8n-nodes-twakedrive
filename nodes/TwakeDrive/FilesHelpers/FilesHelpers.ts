import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';

export async function getFileFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemsOut: INodeExecutionData[] = this.getInputData();
	const itemBag: Record<string, any> = {};
	const cred = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const instanceUrl = cred.instanceUrl.replace(/\/$/, '');
	const targetType = this.getNodeParameter('targetType', itemIndex, 'folder') as 'file' | 'folder';
	const idParam = this.getNodeParameter('targetId', itemIndex, '') as string;
	const wantedFilesArray: any[] = [];
	itemBag.targetType = targetType;
	if (targetType === 'file') {
		if (!idParam) {
			throw new NodeOperationError(this.getNode(), 'File ID is required when Target = "File"', {
				itemIndex,
			});
		}
		itemBag.targetId = idParam;
		// --- Metadata
		const metaResp = await this.helpers.requestWithAuthentication.call(
			this,
			'twakeDriveOAuth2Api',
			{
				method: 'GET',
				baseURL: instanceUrl,
				url: `/files/${encodeURIComponent(idParam)}`,
				headers: { Accept: 'application/vnd.api+json' },
				json: true,
			} as any,
		);
		const metaPayload = (metaResp as any)?.data ?? metaResp;
		const single = (metaPayload?.data ?? metaPayload) as any;
		wantedFilesArray.push(single);
		itemBag.file = wantedFilesArray;

		// --- Binary
		const fileId = single?.id || idParam;
		const fileName = single?.attributes?.name || String(fileId);
		const mimeType = single?.attributes?.mime || 'application/octet-stream';
		const downloadUrl = `${instanceUrl}/files/download/${encodeURIComponent(fileId)}`;
		const dl = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
			method: 'GET',
			baseURL: instanceUrl,
			url: `/files/download/${encodeURIComponent(fileId)}`,
			headers: { Accept: '*/*' },
			json: false,
			responseType: 'arraybuffer',
			encoding: null as any,
		} as any);
		const body = dl && typeof dl === 'object' && 'data' in dl ? (dl as any).data : dl;
		let buf: Buffer;
		if (Buffer.isBuffer(body)) {
			buf = body;
		} else if (body instanceof ArrayBuffer) {
			buf = Buffer.from(new Uint8Array(body));
		} else if (ArrayBuffer.isView(body)) {
			const view = body as ArrayBufferView;
			buf = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
		} else if (typeof body === 'string') {
			buf = Buffer.from(body, 'binary');
		} else if ((body as any)?.type === 'Buffer' && Array.isArray((body as any)?.data)) {
			buf = Buffer.from((body as any).data);
		} else {
			ezlog('download.unexpected', { kind: typeof body, keys: Object.keys(body || {}) });
			throw new NodeOperationError(this.getNode(), 'Unexpected binary response type');
		}
		const binaryData = await this.helpers.prepareBinaryData(buf, fileName, mimeType);

		// --- Dynamic property name
		const inputItem = itemsOut[itemIndex] ?? {};
		let keySource: 'json' | 'binary' | 'default' = 'default';
		let binaryPropertyName =
			typeof (inputItem?.json as any)?.binaryPropertyName === 'string' &&
			(inputItem!.json as any).binaryPropertyName.trim()
				? (inputItem!.json as any).binaryPropertyName.trim()
				: '';
		if (!binaryPropertyName) {
			const existingKeys = Object.keys(inputItem?.binary ?? {});
			if (existingKeys.length === 1) {
				binaryPropertyName = existingKeys[0];
				keySource = 'binary';
			}
		}
		if (!binaryPropertyName) {
			binaryPropertyName = 'data';
			keySource = 'default';
		}
		const existingKeys = Object.keys(inputItem?.binary ?? {});
		let finalKey = binaryPropertyName;
		if (existingKeys.includes(finalKey)) {
			let c = 2;
			while (existingKeys.includes(`${finalKey}_${c}`)) c++;
			finalKey = `${finalKey}_${c}`;
		}
		itemsOut[itemIndex].binary = {
			...(itemsOut[itemIndex].binary || {}),
			[finalKey]: binaryData,
		};
		itemBag.binary = {
			filename: fileName,
			mimeType,
			size: binaryData.fileSize,
			downloadUrl,
			property: finalKey,
			keySource,
		};
		itemsOut[itemIndex].json = itemsOut[itemIndex].json || {};
		(itemsOut[itemIndex].json as any).getFile = itemBag;

		ezlog('getFile', itemBag);
		return { getFile: { wantedFilesArray: wantedFilesArray } };
	}

	// --- targetType === 'folder'
	const listDirId = idParam || 'io.cozy.files.root-dir';
	itemBag.targetId = listDirId;
	const maxItems = 2000;
	let cursor: string | null = null;

	while (true) {
		const qs: Record<string, string | number> = { 'page[limit]': 30 };
		if (cursor) qs['page[cursor]'] = cursor;

		const resp = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
			method: 'GET',
			baseURL: instanceUrl,
			url: `/files/${encodeURIComponent(listDirId)}`,
			qs,
			headers: { Accept: 'application/vnd.api+json' },
			json: true,
		} as any);

		const chunk = Array.isArray((resp as any)?.included) ? (resp as any).included : [];
		if (chunk.length) wantedFilesArray.push(...chunk);
		if (wantedFilesArray.length >= maxItems) {
			itemBag.cappedAtMaxItems = { maxItems, current: wantedFilesArray.length };
			break;
		}

		const nextPageLink = (resp as any)?.links?.next as string | undefined;
		cursor = nextPageLink
			? new URL(nextPageLink, instanceUrl).searchParams.get('page[cursor]')
			: null;
		if (!cursor) break;
	}

	itemBag.total = wantedFilesArray.length;
	itemBag.files = wantedFilesArray;
	itemsOut[itemIndex].json = itemsOut[itemIndex].json || {};
	(itemsOut[itemIndex].json as any).getFolder = {
		dirId: listDirId,
		total: wantedFilesArray.length,
	};

	ezlog('getFolder', itemBag);

	return { getFolder: { wantedFilesArray: wantedFilesArray } };
}

export async function uploadFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
) {
	const logBag: Record<string, any> = {};
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
		instanceUrl: string;
	};
	const baseUrl = instanceUrl.replace(/\/+$/, '');
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	const binPropName = (this.getNodeParameter('binaryPropertyName', itemIndex, '') as string).trim();
	const overwriteIfExists = this.getNodeParameter('overwriteIfExists', itemIndex, false) as boolean;
	const targetDirId = dirId || 'io.cozy.files.root-dir';
	const binaries = items[itemIndex].binary || {};
	const keys = Object.keys(binaries);

	logBag.dirId = targetDirId;

	let chosenKey: string | undefined;
	if (binPropName && binaries[binPropName]) chosenKey = binPropName;
	else if (!binPropName && keys.length === 1) chosenKey = keys[0];
	else {
		throw new NodeOperationError(
			this.getNode(),
			`UploadFile - Ambiguous binary selection. Present keys: ${keys.join(', ')}. Set "binaryPropertyName".`,
			{ itemIndex },
		);
	}

	const bin = binaries[chosenKey!];
	if (!bin) {
		throw new NodeOperationError(this.getNode(), `UploadFile - Binary "${chosenKey}" not found`, {
			itemIndex,
		});
	}

	const fileName = bin.fileName as string;
	const mimeType = (bin.mimeType as string) || 'application/octet-stream';
	const fileBuffer = Buffer.from(bin.data as string, 'base64');

	logBag.binaryPropertyName = chosenKey;
	logBag.fileName = fileName;

	let existingFileId: string | undefined;
	if (overwriteIfExists) {
		const findBody = {
			selector: {
				dir_id: targetDirId,
				name: fileName,
				type: 'file',
				trashed: false,
			},
			limit: 1,
		};
		const findResp = await this.helpers.requestWithAuthentication.call(
			this,
			'twakeDriveOAuth2Api',
			{
				method: 'POST',
				url: `${baseUrl}/files/_find`,
				body: findBody,
				json: true,
			},
		);
		const arr = Array.isArray(findResp?.data) ? findResp.data : [];
		existingFileId = arr[0]?.id;
	}

	let response: any;

	if (existingFileId) {
		response = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
			method: 'PUT',
			url: `${baseUrl}/files/${existingFileId}`,
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': mimeType,
			},
			body: fileBuffer,
			json: true,
			timeout: 30000,
		});
		logBag.overwrite = { used: true, existingFileId };
	} else {
		response = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
			method: 'POST',
			url: `${baseUrl}/files/${targetDirId}`,
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': mimeType,
			},
			qs: { Name: fileName, Type: 'file' },
			body: fileBuffer,
			json: true,
			timeout: 30000,
		});
		logBag.overwrite = { used: false };
	}

	logBag.fileId = response?.data?.id ?? response?.id;
	logBag.file = response;
	ezlog('uploadFile', logBag);

	return {
		uploadFile: { dirId: logBag.dirId, file: response },
	};
}

export async function copyFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
		instanceUrl: string;
	};
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const fileId = this.getNodeParameter('fileId', itemIndex) as string;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	const wantsCustomName = this.getNodeParameter('customName', itemIndex, false) as boolean;
	const newName = wantsCustomName
		? (this.getNodeParameter('newName', itemIndex) as string)
		: undefined;

	const targetDirId = dirId || 'io.cozy.files.root-dir';
	const qs: Record<string, string> = {};

	itemBag.dirId = targetDirId;
	itemBag.customName = wantsCustomName ? newName : null;

	if (dirId) qs.DirID = dirId;
	if (newName) qs.Name = newName;

	const copiedFile = await this.helpers.requestWithAuthentication.call(
		this,
		'twakeDriveOAuth2Api',
		{
			method: 'POST',
			url: `${baseUrl}/files/${encodeURIComponent(fileId)}/copy`,
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/json',
			},
			qs,
			json: true,
		},
	);

	itemBag.copyId = copiedFile?.data?.id ?? copiedFile?.id;
	itemBag.file = copiedFile;
	ezlog('copyFile', itemBag);

	return {
		copyFile: { dirId: itemBag.dirId, file: copiedFile },
	};
}

export async function deleteFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
		instanceUrl: string;
	};
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const fileId = this.getNodeParameter('targetId', itemIndex, '') as string;

	const deletedFileResponse = await this.helpers.requestWithAuthentication.call(
		this,
		'twakeDriveOAuth2Api',
		{
			method: 'DELETE',
			url: `${baseUrl}/files/${encodeURIComponent(fileId)}`,
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/json',
			},
			json: true,
		},
	);

	itemBag.deletedFileId = deletedFileResponse?.data?.id ?? deletedFileResponse?.id ?? fileId;
	itemBag.deletedFile = deletedFileResponse;
	ezlog('deleteFile', itemBag);

	return {
		deleteFile: {
			deletedFileId: itemBag.deletedFileId,
			deletedFile: deletedFileResponse,
		},
	};
}

export async function createFileFromText(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
		instanceUrl: string;
	};
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const dirIdParam =
		(this.getNodeParameter('dirId', itemIndex, '') as string) || 'io.cozy.files.root-dir';
	const textContent = this.getNodeParameter('textContent', itemIndex, '') as string;
	const fileName = this.getNodeParameter('newName', itemIndex, '') as string;

	itemBag.destinationDirId = dirIdParam;
	itemBag.filename = fileName;
	itemBag.textContentLength = textContent?.length ?? 0;

	const createdFileResponseRaw = await this.helpers.requestWithAuthentication.call(
		this,
		'twakeDriveOAuth2Api',
		{
			method: 'POST',
			url: `${baseUrl}/files/${encodeURIComponent(dirIdParam)}`,
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'text/plain; charset=utf-8',
			},
			qs: {
				Name: fileName,
				Type: 'file',
			},
			body: textContent,
			json: true,
		},
	);

	const createdFileResponse =
		typeof createdFileResponseRaw === 'string'
			? JSON.parse(createdFileResponseRaw)
			: createdFileResponseRaw;

	itemBag.createdFileId = createdFileResponse?.data?.id ?? createdFileResponse?.id;
	itemBag.createdFile = createdFileResponse;
	ezlog('createFileFromText', itemBag);

	return {
		createFileFromText: {
			dirId: dirIdParam,
			createdFileId: itemBag.createdFileId,
			file: createdFileResponse,
		},
	};
}

export async function moveFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
		instanceUrl: string;
	};
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const dirIdParam =
		(this.getNodeParameter('dirId', itemIndex, '') as string) || 'io.cozy.files.root-dir';
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;

	const movedFileResponseRaw = await this.helpers.requestWithAuthentication.call(
		this,
		'twakeDriveOAuth2Api',
		{
			method: 'PATCH',
			url: `${baseUrl}/files/${encodeURIComponent(fileId)}`,
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/vnd.api+json',
			},
			body: {
				data: {
					attributes: {
						dir_id: dirIdParam,
					},
				},
			},
			json: true,
		},
	);

	const movedFileResponse =
		typeof movedFileResponseRaw === 'string'
			? JSON.parse(movedFileResponseRaw)
			: movedFileResponseRaw;

	itemBag.destinationDirId = dirIdParam;
	itemBag.movedFileId = movedFileResponse?.data?.id ?? movedFileResponse?.id ?? fileId;
	itemBag.movedFile = movedFileResponse;
	ezlog('moveFile', itemBag);

	return {
		moveFile: {
			fileId,
			dirId: dirIdParam,
			file: movedFileResponse,
		},
	};
}

export async function updateFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
		instanceUrl: string;
	};
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const binPropName =
		(this.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string) || 'data';
	const binaryData = items[itemIndex].binary?.[binPropName];

	if (!binaryData) {
		throw new NodeOperationError(
			this.getNode(),
			`UpdateFile - Binary data not found in "${binPropName}"`,
			{ itemIndex },
		);
	}

	const wantsCustomName = this.getNodeParameter('customName', itemIndex) as boolean;
	const newName = wantsCustomName
		? (this.getNodeParameter('newName', itemIndex) as string)
		: undefined;

	const fileBuffer = Buffer.from(binaryData.data, 'base64');
	const mimeType = binaryData.mimeType || 'application/octet-stream';

	itemBag.fileId = fileId;
	itemBag.binaryPropertyName = binPropName;
	itemBag.byteLength = fileBuffer.byteLength;

	// Update content
	const updatedFileResponseRaw = await this.helpers.requestWithAuthentication.call(
		this,
		'twakeDriveOAuth2Api',
		{
			method: 'PUT',
			url: `${baseUrl}/files/${encodeURIComponent(fileId)}`,
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': mimeType,
			},
			body: fileBuffer,
			json: true,
		},
	);

	const updatedFileResponse =
		typeof updatedFileResponseRaw === 'string'
			? JSON.parse(updatedFileResponseRaw)
			: updatedFileResponseRaw;

	itemBag.updatedFile = updatedFileResponse;

	// Rename
	let changedFilenameResponse: any = null;
	if (newName) {
		itemBag.newFilename = newName;

		const renameRaw = await this.helpers.requestWithAuthentication.call(
			this,
			'twakeDriveOAuth2Api',
			{
				method: 'PATCH',
				url: `${baseUrl}/files/${encodeURIComponent(fileId)}`,
				headers: {
					Accept: 'application/vnd.api+json',
					'Content-Type': 'application/vnd.api+json',
				},
				body: {
					data: {
						type: 'io.cozy.files',
						id: fileId,
						attributes: { name: newName },
					},
				},
				json: true,
			},
		);

		changedFilenameResponse = typeof renameRaw === 'string' ? JSON.parse(renameRaw) : renameRaw;
		itemBag.rename = changedFilenameResponse;
	}

	ezlog('updateFile', itemBag);

	return {
		updateFile: {
			fileId,
			contentUpdate: updatedFileResponse,
			nameUpdate: changedFilenameResponse,
		},
	};
}

export async function renameFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
		instanceUrl: string;
	};
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const newName = this.getNodeParameter('newName', itemIndex, '') as string;

	if (!newName?.trim()) {
		throw new NodeOperationError(this.getNode(), 'renameFile - "newName" is required', {
			itemIndex,
		});
	}

	itemBag.fileId = fileId;
	itemBag.newName = newName;

	const renameRaw = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
		method: 'PATCH',
		url: `${baseUrl}/files/${encodeURIComponent(fileId)}`,
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: {
			data: {
				type: 'io.cozy.files',
				id: fileId,
				attributes: { name: newName },
			},
		},
		json: true,
	});

	const renameResponse = typeof renameRaw === 'string' ? JSON.parse(renameRaw) : renameRaw;
	itemBag.renamedFile = renameResponse;
	ezlog('renameFile', itemBag);

	return {
		renameFile: {
			fileId,
			newName,
			file: renameResponse,
		},
	};
}
