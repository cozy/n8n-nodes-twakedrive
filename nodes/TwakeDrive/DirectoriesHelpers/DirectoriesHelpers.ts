import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export async function createFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const instanceUrl = credentials.instanceUrl;
	const realToken = credentials.apiToken;

	const dirName = this.getNodeParameter('dirName', itemIndex, '') as string;
	const useCustomDir = this.getNodeParameter('dirId', itemIndex, false) as boolean;
	const targetDirId = useCustomDir
		? (this.getNodeParameter('dirId', itemIndex, '') as string)
		: 'io.cozy.files.root-dir';

	if (useCustomDir && !targetDirId) {
		throw new NodeOperationError(
			this.getNode(),
			'Directory ID is required when "Choose Destination Folder" is enabled',
			{ itemIndex },
		);
	}

	const url = `${instanceUrl}/files/${encodeURIComponent(targetDirId)}`;
	const qs: Record<string, string> = { Type: 'directory', Name: dirName };

	try {
		const response = await this.helpers.httpRequest({
			method: 'POST',
			url,
			qs,
			headers: {
				Authorization: `Bearer ${realToken}`,
				Accept: 'application/vnd.api+json',
			},
			json: true,
		});

		const createdFolderId = response?.data?.id;
		if (!createdFolderId) {
			throw new NodeOperationError(this.getNode(), 'Missing created folder id in response', {
				itemIndex,
			});
		}

		ezlog('createdFolderId', createdFolderId);
		ezlog('createdFolderParent', targetDirId);
		ezlog('createdFolder', response?.data);

		return { createdFolderId };
	} catch (error: any) {
		throw new NodeOperationError(this.getNode(), error, { itemIndex });
	}
}

export async function deleteFolder(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
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

		ezlog('deletedFolderId', dirId);
		return { deletedFolderId: dirId };
	} catch (error: any) {
		throw new NodeOperationError(this.getNode(), error, { itemIndex });
	}
}
