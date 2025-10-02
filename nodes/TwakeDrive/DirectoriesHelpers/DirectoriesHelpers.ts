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
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveApi')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const dirId = this.getNodeParameter('dirId', itemIndex, '') as string;
	if (!dirId) {
		throw new NodeOperationError(this.getNode(), 'Directory ID is required', { itemIndex });
	}

	const resRaw = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveApi', {
		method: 'DELETE',
		url: `${baseUrl}/files/${encodeURIComponent(dirId)}`,
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/json',
		},
		json: true,
	});

	const res =
		typeof resRaw === 'string'
			? resRaw.trim().length
				? JSON.parse(resRaw)
				: null
			: (resRaw ?? null);

	itemBag.deletedFolderId = dirId;
	itemBag.response = res;
	ezlog('deleteFolder', itemBag);

	return {
		deleteFolder: {
			deletedFolderId: dirId,
			response: res,
		},
	};
}

export async function moveFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveApi')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const folderId = this.getNodeParameter('folderId', itemIndex, '') as string;
	const useCustomDir = this.getNodeParameter('customDir', itemIndex, false) as boolean;
	const destDirId = useCustomDir
		? (this.getNodeParameter('dirId', itemIndex, '') as string) || ''
		: 'io.cozy.files.root-dir';

	if (!folderId) {
		throw new NodeOperationError(this.getNode(), 'Folder ID is required', { itemIndex });
	}
	if (!destDirId) {
		throw new NodeOperationError(this.getNode(), 'Destination Directory ID is required', {
			itemIndex,
		});
	}

	const resRaw = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveApi', {
		method: 'PATCH',
		url: `${baseUrl}/files/${encodeURIComponent(folderId)}`,
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: {
			data: {
				attributes: { dir_id: destDirId },
			},
		},
		json: true,
	});

	const res = typeof resRaw === 'string' ? JSON.parse(resRaw) : resRaw;

	itemBag.movedFolderId = folderId;
	itemBag.destinationFolderId = destDirId;
	itemBag.folder = res;
	ezlog('moveFolder', itemBag);

	return {
		moveFolder: {
			folderId,
			destinationDirId: destDirId,
			movedFolder: res,
		},
	};
}

export async function renameFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveApi')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const folderId = this.getNodeParameter('folderId', itemIndex, '') as string;
	const newFolderName = this.getNodeParameter('newFolderName', itemIndex, '') as string;

	if (!folderId) {
		throw new NodeOperationError(this.getNode(), 'Folder ID is required', { itemIndex });
	}
	if (!newFolderName?.trim()) {
		throw new NodeOperationError(this.getNode(), 'New Folder Name is required', { itemIndex });
	}

	const resRaw = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveApi', {
		method: 'PATCH',
		url: `${baseUrl}/files/${encodeURIComponent(folderId)}`,
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: {
			data: {
				type: 'io.cozy.files',
				id: folderId,
				attributes: { name: newFolderName },
			},
		},
		json: true,
	});

	const res = typeof resRaw === 'string' ? JSON.parse(resRaw) : resRaw;

	itemBag.renamedFolderId = folderId;
	itemBag.renamedFolderNewName = newFolderName;
	itemBag.folder = res;
	ezlog('renameFolder', itemBag);

	return {
		renameFolder: {
			folderId,
			newName: newFolderName,
			folder: res,
		},
	};
}
