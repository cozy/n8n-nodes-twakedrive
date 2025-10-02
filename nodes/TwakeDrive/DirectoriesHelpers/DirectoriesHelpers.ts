import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export async function createFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveApi')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const dirName = this.getNodeParameter('dirName', itemIndex, '') as string;
	const useCustomDir = this.getNodeParameter('customDir', itemIndex, false) as boolean; // <-- FIX
	const targetDirId = useCustomDir
		? (this.getNodeParameter('dirId', itemIndex, '') as string) || ''
		: 'io.cozy.files.root-dir';

	if (useCustomDir && !targetDirId) {
		throw new NodeOperationError(
			this.getNode(),
			'Directory ID is required when "Choose Destination Folder" is enabled',
			{ itemIndex },
		);
	}

	const url = `${baseUrl}/files/${encodeURIComponent(targetDirId)}`;
	const qs: Record<string, string> = { Type: 'directory', Name: dirName };

	const resRaw = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveApi', {
		method: 'POST',
		url,
		qs,
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/json',
		},
		json: true,
	});

	const res = typeof resRaw === 'string' ? JSON.parse(resRaw) : resRaw;

	const createdFolderId = res?.data?.id ?? res?.id;
	if (!createdFolderId) {
		throw new NodeOperationError(this.getNode(), 'Missing created folder id in response', {
			itemIndex,
		});
	}

	itemBag.createdFolderId = createdFolderId;
	itemBag.createdFolderParent = targetDirId;
	itemBag.createdFolder = res?.data ?? res;
	ezlog('createFolder', itemBag);

	return {
		createFolder: {
			parentDirId: targetDirId,
			createdFolderId,
			folder: res,
		},
	};
}

export async function deleteFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const realToken = credentials.apiToken;

	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	if (!dirId) {
		throw new NodeOperationError(this.getNode(), 'Directory ID is required', { itemIndex });
	}

	const url = `${instanceUrl}/files/${encodeURIComponent(dirId)}`;

	try {
		await this.helpers.httpRequest({
			method: 'DELETE',
			url,
			headers: {
				Authorization: `Bearer ${realToken}`,
				Accept: 'application/vnd.api+json',
			},
			json: true,
		});
		itemBag.deletedFolderId = dirId;
		ezlog('deleteFolder', itemBag);
		return { deletedFolderId: dirId };
	} catch (error: any) {
		throw new NodeOperationError(this.getNode(), error, { itemIndex });
	}
}

export async function moveFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const realToken = credentials.apiToken;

	const folderId = this.getNodeParameter('folderId', itemIndex, '') as string;
	const useCustomDir = this.getNodeParameter('customDir', itemIndex, false) as boolean;
	const destDirId = useCustomDir
		? (this.getNodeParameter('dirId', itemIndex, '') as string)
		: 'io.cozy.files.root-dir';

	if (!folderId) {
		throw new NodeOperationError(this.getNode(), 'Folder ID is required', { itemIndex });
	}
	if (!destDirId) {
		throw new NodeOperationError(this.getNode(), 'Destination Directory ID is required', {
			itemIndex,
		});
	}

	const url = `${instanceUrl}/files/${encodeURIComponent(folderId)}`;

	const movedFolderResponse = await this.helpers.httpRequest({
		method: 'PATCH',
		url,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: JSON.stringify({
			data: {
				attributes: { dir_id: destDirId },
			},
		}),
	});
	itemBag.movedFolderId = folderId;
	itemBag.destinationFolderId = destDirId;
	ezlog('moveFolder', itemBag);
	return { movedFolderResponse };
}

export async function renameFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const itemBag: { [key: string]: any } = {};
	const instanceUrl = credentials.instanceUrl;
	const realToken = credentials.apiToken;
	const folderId = this.getNodeParameter('folderId', itemIndex, '') as string;
	const newFolderName = this.getNodeParameter('newFolderName', itemIndex, '') as string;
	if (!folderId) {
		throw new NodeOperationError(this.getNode(), 'Folder ID is required', { itemIndex });
	}
	if (!newFolderName) {
		throw new NodeOperationError(this.getNode(), 'New Folder Name is required', { itemIndex });
	}
	const url = `${instanceUrl}/files/${encodeURIComponent(folderId)}`;
	const renameResponse = await this.helpers.httpRequest({
		method: 'PATCH',
		url,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: JSON.stringify({
			data: {
				type: 'io.cozy.files',
				id: folderId,
				attributes: { name: newFolderName },
			},
		}),
		json: true,
	});
	itemBag.renamedFolderId = folderId;
	itemBag.renamedFolderNewName = newFolderName;
	ezlog('renameFolder', itemBag);
	return { renameResponse };
}
