import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';

export async function listFiles(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const instanceUrl = credentials.instanceUrl;
	const realToken = credentials.apiToken;

	const targetType = this.getNodeParameter('targetType', itemIndex, 'folder') as 'file' | 'folder';

	const idParam =
		(this.getNodeParameter('targetId', itemIndex, '') as string) ||
		(this.getNodeParameter('listDirId', itemIndex, '') as string);

	if (targetType === 'file') {
		if (!idParam) {
			throw new NodeOperationError(this.getNode(), 'File ID is required when Target = "File"', {
				itemIndex,
			});
		}

		const resp = await this.helpers.httpRequest({
			method: 'GET',
			url: `${instanceUrl}/files/${encodeURIComponent(idParam)}`,
			headers: {
				Authorization: `Bearer ${realToken}`,
				Accept: 'application/vnd.api+json',
			},
			json: true,
		});

		const single = resp?.data ?? resp;
		const wantedFilesArray = [single];

		ezlog('list.singleFile', { id: idParam });
		return { wantedFilesArray };
	}

	// targetType === 'folder'
	const listDirId = idParam || 'io.cozy.files.root-dir';

	const wantedFilesArray: any[] = [];
	const maxItems = 2000;
	let cursor: string | null = null;

	while (true) {
		const qs: Record<string, string | number> = {};
		// limited to 30 (cozy API default), can be increased
		qs['page[limit]'] = 30;
		if (cursor) qs['page[cursor]'] = cursor;

		const resp = await this.helpers.httpRequest({
			method: 'GET',
			url: `${instanceUrl}/files/${encodeURIComponent(listDirId)}`,
			qs,
			headers: {
				Authorization: `Bearer ${realToken}`,
				Accept: 'application/vnd.api+json',
			},
			json: true,
		});

		const chunk = Array.isArray(resp?.included) ? resp.included : [];
		if (chunk.length) wantedFilesArray.push(...chunk);
		if (wantedFilesArray.length >= maxItems) {
			ezlog('listByDirectory.cappedAtMaxItems', {
				maxItems,
				current: wantedFilesArray.length,
			});
			break;
		}

		const nextPageLink = resp?.links?.next as string | undefined;
		cursor = nextPageLink
			? new URL(nextPageLink, instanceUrl).searchParams.get('page[cursor]')
			: null;
		if (!cursor) break;
	}

	ezlog('listFiles', { dirId: listDirId, total: wantedFilesArray.length });
	return { wantedFilesArray };
}

export async function uploadFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const instanceUrl = credentials.instanceUrl;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${dirId}`;
	const binPropName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data');
	const binaryData = items[itemIndex].binary?.[binPropName];
	const realToken = credentials.apiToken;

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
	ezlog('createFileResponse', createdFileResponse);
	const createdFileId = createdFileResponse.data.id;
	ezlog('createdFileID', createdFileId);
	return { createdFileId };
}

export async function copyFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
): Promise<void> {
	const instanceUrl = credentials.instanceUrl;
	const fileId = this.getNodeParameter('fileId', itemIndex) as string;
	const dirId = this.getNodeParameter('dirId', itemIndex) as string;
	const wantsCustomName = this.getNodeParameter('customName', itemIndex) as boolean;
	const newName = wantsCustomName
		? (this.getNodeParameter('newName', itemIndex) as string)
		: undefined;
	const realToken = credentials.apiToken;
	const qs: Record<string, string> = {};

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
	ezlog('copiedFile', copiedFile);
}

export async function deleteFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
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
	ezlog('deletedFileResponse', deletedFileResponse);
	return { deletedFileResponse };
}

export async function createFileFromText(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const instanceUrl = credentials.instanceUrl;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	const textContent = this.getNodeParameter('textContent', itemIndex, '') as string;
	const fileName = this.getNodeParameter('newName', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${dirId}`;
	const realToken = credentials.apiToken;
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
	ezlog('createdFileResponse', createdFileResponse);
	return { createdFileResponse };
}

export async function moveFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const instanceUrl = credentials.instanceUrl;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	ezlog('dirID', dirId);
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	ezlog('fileUrl', fileUrl);
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
	ezlog('movedFileResponse', movedFileResponse);
	return { movedFileResponse };
}

export async function updateFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const instanceUrl = credentials.instanceUrl;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	ezlog('dirID', dirId);
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	ezlog('fileUrl', fileUrl);
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
	ezlog('updatedFileResponse', updatedFileResponse);

	// Change filename if asked
	if (newName) {
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
		ezlog('changedFileNameResponse', changedFilenameResponse);
		return { changedFilenameResponse };
	}
	return { updatedFileResponse };
}
