import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';

export async function listFiles(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemsOut: INodeExecutionData[] = this.getInputData();
	const itemBag: Record<string, any> = {};
	const instanceUrl = credentials.instanceUrl.replace(/\/$/, '');
	const realToken = credentials.apiToken;

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

		// Metadata
		const metaResp = await this.helpers.httpRequest({
			method: 'GET',
			url: `${instanceUrl}/files/${encodeURIComponent(idParam)}`,
			headers: { Authorization: `Bearer ${realToken}`, Accept: 'application/vnd.api+json' },
			json: true,
		});
		const single = (metaResp as any)?.data ?? metaResp;
		wantedFilesArray.push(single);
		itemBag.file = wantedFilesArray;

		// Binary
		const fileId = single?.id || idParam;
		const fileName = single?.attributes?.name || String(fileId);
		const mimeType = single?.attributes?.mime || 'application/octet-stream';
		const downloadUrl = `${instanceUrl}/files/download/${encodeURIComponent(fileId)}`;

		const binResp = await this.helpers.httpRequest({
			method: 'GET',
			url: downloadUrl,
			headers: { Authorization: `Bearer ${realToken}`, Accept: '*/*' },
			json: false,
			encoding: 'arraybuffer',
		});
		const buf: Buffer = Buffer.isBuffer(binResp)
			? (binResp as Buffer)
			: Buffer.from(binResp as ArrayBuffer);
		const binaryData = await this.helpers.prepareBinaryData(buf, fileName, mimeType);

		// Dynamic property name
		const inputItem = itemsOut[itemIndex] ?? {};
		let keySource: 'json' | 'binary' | 'default' = 'default';

		// Priority set to $json.binaryPropertyName
		let binaryPropertyName =
			typeof (inputItem?.json as any)?.binaryPropertyName === 'string' &&
			(inputItem!.json as any).binaryPropertyName.trim()
				? (inputItem!.json as any).binaryPropertyName.trim()
				: '';

		// Else if only one binary key, reuse it
		if (!binaryPropertyName) {
			const existingKeys = Object.keys(inputItem?.binary ?? {});
			if (existingKeys.length === 1) {
				binaryPropertyName = existingKeys[0];
				keySource = 'binary';
			}
		}

		// Fallback
		if (!binaryPropertyName) {
			binaryPropertyName = 'data';
			keySource = 'default';
		}

		// Avoid overwrite if key already exists
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
		ezlog('listFiles', itemBag);

		return { wantedFilesArray };
	}

	// targetType === 'folder'
	const listDirId = idParam || 'io.cozy.files.root-dir';
	itemBag.targetId = listDirId;
	const maxItems = 2000;
	let cursor: string | null = null;

	while (true) {
		const qs: Record<string, string | number> = {};
		qs['page[limit]'] = 30;
		if (cursor) qs['page[cursor]'] = cursor;

		const resp = await this.helpers.httpRequest({
			method: 'GET',
			url: `${instanceUrl}/files/${encodeURIComponent(listDirId)}`,
			qs,
			headers: { Authorization: `Bearer ${realToken}`, Accept: 'application/vnd.api+json' },
			json: true,
		});

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
	ezlog('listFiles', itemBag);

	return { wantedFilesArray };
}

export async function uploadFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${dirId}`;
	const binPropName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data');
	const binaryData = items[itemIndex].binary?.[binPropName];
	const realToken = credentials.apiToken;

	itemBag.dirId = dirId || 'io.cozy.files.root-dir';

	if (!binaryData) {
		throw new NodeOperationError(this.getNode(), 'UploadFile - Binary data not found', {
			itemIndex,
		});
	}

	const fileName = binaryData.fileName;
	const fileData = binaryData.data;
	const mimeType = binaryData.mimeType;

	const fileBuffer = Buffer.from(fileData, 'base64');

	const createdFileResponse = await this.helpers.httpRequest({
		method: 'POST',
		url: fileUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
			'Content-Type': mimeType,
		},
		qs: {
			Name: fileName,
			Type: 'file',
		},
		body: fileBuffer,
	});
	const createdFileId = createdFileResponse.data.id;
	itemBag.uploadedFileId = createdFileId;
	itemBag.file = createdFileResponse;
	ezlog('uploadFile', itemBag);
	return { createdFileId };
}

export async function copyFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
): Promise<void> {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const fileId = this.getNodeParameter('fileId', itemIndex) as string;
	const dirId = this.getNodeParameter('dirId', itemIndex) as string;
	const wantsCustomName = this.getNodeParameter('customName', itemIndex) as boolean;
	const newName = wantsCustomName
		? (this.getNodeParameter('newName', itemIndex) as string)
		: undefined;
	const realToken = credentials.apiToken;
	const qs: Record<string, string> = {};

	itemBag.dirId = dirId || 'io.cozy.files.root-dir';
	itemBag.customName = wantsCustomName ? newName : null;

	if (dirId) {
		qs.DirID = dirId;
	}
	if (newName) {
		qs.Name = newName;
	}

	const copiedFile = await this.helpers.request({
		method: 'POST',
		uri: `${instanceUrl}/files/${fileId}/copy`,
		headers: {
			Authorization: `Bearer ${realToken}`,
			'Content-Type': 'application/json',
		},
		qs,
		json: true,
	});
	itemBag.copyId = copiedFile.data?.id;
	itemBag.file = copiedFile;
	ezlog('copyFile', itemBag);
}

export async function deleteFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const fileId = this.getNodeParameter('targetId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	const realToken = credentials.apiToken;
	const deletedFileResponse = await this.helpers.httpRequest({
		method: 'DELETE',
		url: fileUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
		},
		json: true,
	});
	itemBag.deletedFileId = deletedFileResponse.data?.id;
	itemBag.deletedFile = deletedFileResponse;
	ezlog('deleteFile', itemBag);
	return { deletedFileResponse };
}

export async function createFileFromText(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	const textContent = this.getNodeParameter('textContent', itemIndex, '') as string;
	const fileName = this.getNodeParameter('newName', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${dirId}`;
	const realToken = credentials.apiToken;

	itemBag.destinationDirId = dirId || 'io.cozy.files.root-dir';
	itemBag.textContent = textContent;
	itemBag.filename = fileName;

	const createdFileResponse = await this.helpers.httpRequest({
		method: 'POST',
		url: fileUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
		},
		qs: {
			Name: fileName,
			Type: 'file',
		},
		body: textContent,
	} as any);
	itemBag.createdFileId = createdFileResponse.data?.id;
	itemBag.createdFile = createdFileResponse;
	ezlog('createFileFromText', itemBag);
	return { createdFileResponse };
}

export async function moveFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	itemBag.destinationDirId = dirId || 'io.cozy.files.root-dir';
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	const realToken = credentials.apiToken;

	const movedFileResponse = await this.helpers.httpRequest({
		method: 'PATCH',
		url: fileUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: JSON.stringify({
			data: {
				attributes: {
					dir_id: dirId,
				},
			},
		}),
	});
	itemBag.movedFileId = movedFileResponse.data?.id;
	itemBag.movedFile = movedFileResponse;
	ezlog('moveFile', itemBag);
	return { movedFileResponse };
}

export async function updateFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	itemBag.fileId = fileId;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	const binPropName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data');
	const binaryData = items[itemIndex].binary?.[binPropName];
	const realToken = credentials.apiToken;

	if (!binaryData) {
		throw new NodeOperationError(this.getNode(), 'UpdateFile - Binary data not found', {
			itemIndex,
		});
	}
	const wantsCustomName = this.getNodeParameter('customName', itemIndex) as boolean;
	const newName = wantsCustomName
		? (this.getNodeParameter('newName', itemIndex) as string)
		: undefined;
	const fileData = binaryData.data;
	const mimeType = binaryData.mimeType;
	const fileBuffer = Buffer.from(fileData, 'base64');

	// Change file content
	const updatedFileResponse = await this.helpers.httpRequest({
		method: 'PUT',
		url: fileUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
			'Content-Type': mimeType,
		},
		body: fileBuffer,
	});

	// Change filename if asked
	if (newName) {
		itemBag.newFilename = newName;
		const changedFilenameResponse = await this.helpers.httpRequest({
			method: 'PATCH',
			url: fileUrl,
			headers: {
				Authorization: `Bearer ${realToken}`,
				Accept: 'application/vnd.api+json',
				'Content-Type': mimeType,
			},
			body: {
				data: {
					type: 'io.cozy.files',
					id: fileId,
					attributes: {
						name: newName,
					},
				},
			},
			json: true,
		});
		itemBag.updatedFile = changedFilenameResponse;
		ezlog('updateFile', itemBag);
		return { changedFilenameResponse };
	}
	itemBag.updatedFile = updatedFileResponse;
	ezlog('updateFile', itemBag);
	return { updatedFileResponse };
}
