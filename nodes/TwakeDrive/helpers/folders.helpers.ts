import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { twakeDriveRequest } from './request.helpers';

export async function createFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	_ezlog: (name: string, value: any) => void,
) {
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const dirName = this.getNodeParameter('dirName', itemIndex, '') as string;
	const dirSelectMode = this.getNodeParameter('dirSelectMode', itemIndex, 'dropdown') as 'dropdown' | 'byId';

	const targetDirId =
		dirSelectMode === 'byId'
			? ((this.getNodeParameter('dirIdById', itemIndex, '') as string) || '')
			: ((this.getNodeParameter('parentDirIdDest', itemIndex, '') as string) || 'io.cozy.files.root-dir');

	if (!targetDirId) {
		throw new NodeOperationError(this.getNode(), 'Destination directory is required', { itemIndex });
	}

	const resRaw = await twakeDriveRequest.call(this, {
		method: 'POST',
	  url: `${baseUrl}/files/${encodeURIComponent(targetDirId)}`,
	  qs: { Type: 'directory', Name: dirName },
	  headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/json' },
	  json: true,
  });

	const res = typeof resRaw === 'string' ? JSON.parse(resRaw) : resRaw;

	const items = this.getInputData();
	if (!items[itemIndex]) items[itemIndex] = { json: {} };
	items[itemIndex].json = res;

	return;
}

export async function deleteFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	_ezlog: (name: string, value: any) => void,
) {
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const fileSelectMode = this.getNodeParameter('fileSelectMode', itemIndex, 'dropdown') as 'dropdown' | 'byId';
	const dirId =
		fileSelectMode === 'byId'
			? ((this.getNodeParameter('sourceFolderIdById', itemIndex, '') as string) || '')
			: ((this.getNodeParameter('parentDirIdFile', itemIndex, '') as string) || '');

	if (!dirId) throw new NodeOperationError(this.getNode(), 'Directory ID is required', { itemIndex });
	if (dirId === 'io.cozy.files.root-dir') {
		throw new NodeOperationError(this.getNode(), 'Cannot delete root directory', { itemIndex });
	}

	const resRaw = await twakeDriveRequest.call(this, {
		method: 'DELETE',
		url: `${baseUrl}/files/${encodeURIComponent(dirId)}`,
	  headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/json' },
	  json: true,
  });

	const res =
		typeof resRaw === 'string'
			? resRaw.trim().length
				? JSON.parse(resRaw)
				: null
			: (resRaw ?? null);

	const items = this.getInputData();
	if (!items[itemIndex]) items[itemIndex] = { json: {} };
	items[itemIndex].json = res;

	return;
}

export async function moveFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	_ezlog: (name: string, value: any) => void,
) {
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const fileSelectMode = this.getNodeParameter('fileSelectMode', itemIndex, 'dropdown') as 'dropdown' | 'byId';
	const folderId =
		fileSelectMode === 'byId'
			? ((this.getNodeParameter('sourceFolderIdById', itemIndex, '') as string) || '')
			: ((this.getNodeParameter('parentDirIdFile', itemIndex, '') as string) || '');

	const dirSelectMode = this.getNodeParameter('dirSelectMode', itemIndex, 'dropdown') as 'dropdown' | 'byId';
	const destDirId =
		dirSelectMode === 'byId'
			? ((this.getNodeParameter('dirIdById', itemIndex, '') as string) || '')
			: ((this.getNodeParameter('parentDirIdDest', itemIndex, '') as string) || 'io.cozy.files.root-dir');

	if (!folderId) throw new NodeOperationError(this.getNode(), 'Folder ID is required', { itemIndex });
	if (!destDirId) throw new NodeOperationError(this.getNode(), 'Destination directory is required', { itemIndex });
	if (folderId === 'io.cozy.files.root-dir') {
		throw new NodeOperationError(this.getNode(), 'Cannot move root directory', { itemIndex });
	}
	if (folderId === destDirId) {
		throw new NodeOperationError(
			this.getNode(),
			'Destination directory cannot be the same as the folder being moved',
			{ itemIndex },
		);
	}

	const resRaw = await twakeDriveRequest.call(this, {
		method: 'PATCH',
		url: `${baseUrl}/files/${encodeURIComponent(folderId)}`,
	  headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
	  body: { data: { attributes: { dir_id: destDirId } } },
	  json: true,
  });

	const res = typeof resRaw === 'string' ? JSON.parse(resRaw) : resRaw;

	const items = this.getInputData();
	if (!items[itemIndex]) items[itemIndex] = { json: {} };
	items[itemIndex].json = res;

	return;
}

export async function renameFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	_ezlog: (name: string, value: any) => void,
) {
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const fileSelectMode = this.getNodeParameter('fileSelectMode', itemIndex, 'dropdown') as 'dropdown' | 'byId';
	const folderId =
		fileSelectMode === 'byId'
			? ((this.getNodeParameter('sourceFolderIdById', itemIndex, '') as string) || '')
			: ((this.getNodeParameter('parentDirIdFile', itemIndex, '') as string) || '');

	const newFolderName = this.getNodeParameter('newFolderName', itemIndex, '') as string;

	if (!folderId) throw new NodeOperationError(this.getNode(), 'Folder ID is required', { itemIndex });
	if (folderId === 'io.cozy.files.root-dir') {
		throw new NodeOperationError(this.getNode(), 'Cannot rename root directory', { itemIndex });
	}
	if (!newFolderName?.trim()) {
		throw new NodeOperationError(this.getNode(), 'New Folder Name is required', { itemIndex });
	}

	const resRaw = await twakeDriveRequest.call(this, {
		method: 'PATCH',
		url: `${baseUrl}/files/${encodeURIComponent(folderId)}`,
	  headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
	  body: { data: { type: 'io.cozy.files', id: folderId, attributes: { name: newFolderName } } },
	  json: true,
  });

	const res = typeof resRaw === 'string' ? JSON.parse(resRaw) : resRaw;

	const items = this.getInputData();
	if (!items[itemIndex]) items[itemIndex] = { json: {} };
	items[itemIndex].json = res;

	return;
}
