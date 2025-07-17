import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';

export async function getRealToken(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	token: string,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const firstToken = token;

	const permissionsUrl = `${instanceUrl}/permissions`;
	const tokenResponse = await this.helpers.httpRequest({
		method: 'POST',
		url: permissionsUrl,
		headers: {
			Authorization: `Bearer ${firstToken}`,
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: {
			data: {
				type: 'io.cozy.permissions',
				attributes: {
					permissions: {
						'io.cozy.files': {
							description: 'Access your files',
							type: 'io.cozy.files',
							verbs: ['ALL'],
						},
					},
				},
			},
		},
		qs: {
			codes: 'n8n',
		},
		json: true,
	});
	const realToken = tokenResponse.data.attributes.codes.n8n;
	ezlog('realToken', realToken);

	return { realToken };
}

export async function getOneFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const fileId = this.getNodeParameter('fileOrDirId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	const realToken = items[itemIndex].json.realToken;
	const fileResponse = await this.helpers.httpRequest({
		method: 'GET',
		url: fileUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
		},
		json: true,
	});
	ezlog('fileResponse', fileResponse);
	return { fileResponse };
}

export async function listFiles(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const fileListUrl = `${instanceUrl}/data/io.cozy.files/_all_docs?include_docs=true&Fields=name,metadata,type,id,cozyMetadata`;
	const realToken = items[itemIndex].json.realToken;
	const filesListResponse = await this.helpers.httpRequest({
		method: 'GET',
		url: fileListUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/json',
		},
		json: true,
	});
	ezlog('fileListResponse', filesListResponse);
	const docsArray = filesListResponse.rows;
	const wantedFilesArray = [];
	for (let i = 0; i < docsArray.length; i++) {
		// Skipping directories
		// if (docsArray[i].doc.type === 'directory') continue;
		// const filename = docsArray[i].doc.name;
		// const id = docsArray[i].id;
		// const uploadedBy = docsArray[i].doc.cozyMetadata?.uploadedBy.slug;
		// const metadata = docsArray[i].doc.metadata;
		// const oneFile = {
		// 	filename,
		// 	id,
		// 	uploadedBy,
		// 	metadata,
		// };
		wantedFilesArray.push(docsArray[i]);
		// wantedFilesArray.push(oneFile);
	}
	// ezlog('filesList', wantedFilesArray);
	return { wantedFilesArray };
}

export async function uploadFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	const binPropName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data');
	const binaryData = items[itemIndex].binary?.[binPropName];
	const realToken = items[itemIndex].json.realToken;

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

	// ezlog('filesList', wantedFilesArray);
	return { createdFileId };
}

export async function copyFile(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
): Promise<void> {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const fileId = this.getNodeParameter('fileId', itemIndex) as string;
	const dirId = this.getNodeParameter('dirId', itemIndex) as string;
	const wantsCustomName = this.getNodeParameter('customName', itemIndex) as boolean;
	const newName = wantsCustomName
		? (this.getNodeParameter('newName', itemIndex) as string)
		: undefined;
	const realToken = items[itemIndex].json.realToken as string;
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
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const fileId = this.getNodeParameter('fileOrDirId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	const realToken = items[itemIndex].json.realToken;
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
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	ezlog('dirID', dirId);
	const textContent = this.getNodeParameter('textContent', itemIndex, '') as string;
	ezlog('textContent', textContent);
	const fileName = this.getNodeParameter('newName', itemIndex, '') as string;
	ezlog('filename', fileName);
	const fileUrl = `${instanceUrl}/files/${dirId}`;
	ezlog('fileUrl', fileUrl);
	const realToken = items[itemIndex].json.realToken;
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
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	ezlog('dirID', dirId);
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	ezlog('fileUrl', fileUrl);
	const realToken = items[itemIndex].json.realToken;

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
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	ezlog('dirID', dirId);
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	ezlog('fileUrl', fileUrl);
	const binPropName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data');
	const binaryData = items[itemIndex].binary?.[binPropName];
	const realToken = items[itemIndex].json.realToken;

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
