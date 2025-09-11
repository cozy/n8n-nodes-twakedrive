import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import * as TwakeFilesHelpers from './FilesHelpers/FilesHelpers';
import * as TwakeDirectoriesHelpers from './DirectoriesHelpers/DirectoriesHelpers';
import * as TwakeSharingHelpers from './SharingHelpers/SharingHelpers';
import { createEzlog } from './utils/ezlog';

export class TwakeDriveNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Twake Drive',
		name: 'twakeDriveNode',
		group: ['transform'],
		version: 1,
		icon: 'file:icon.svg',
		description: 'Basic Twake Drive',
		defaults: {
			name: 'Twake Drive',
		},
		credentials: [
			{
				name: 'twakeDriveApi',
				required: true,
			},
		],
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'file',
				options: [
					{ name: 'File', value: 'file' },
					{ name: 'Folder', value: 'folder' },
					{ name: 'Share', value: 'share' },
				],
				description: 'Select the type of item to operate on',
			},
			// Operation — FILE
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'listFiles',
				displayOptions: { show: { resource: ['file'] } },
				options: [
					{
						name: 'Copy File',
						value: 'copyFile',
						description:
							'Copy the selected file in the Twake instance in the targeted directory if any',
						action: 'Copy the selected file in the twake instance in the targeted directory if any',
					},
					{
						name: 'Create File From Text',
						value: 'createFileFromText',
						description: 'Create a new text file with given text',
						action: 'Create a new text file with given text',
					},
					{
						name: 'Delete File',
						value: 'deleteFile',
						description: 'Delete the selected file in the Twake instance',
						action: 'Delete the selected file in the twake instance',
					},
					{
						name: 'Get One File',
						value: 'getOneFile',
						description: 'Retrieve a single file or directory by ID',
						action: 'Retrieve a single file or directory by ID.',
					},
					{
						name: 'List Files',
						value: 'listFiles',
						description: 'List all files in the Twake instance',
						action: 'List all files in the targeted directory',
					},
					{
						name: 'Move File',
						value: 'moveFile',
						description: 'Move the targeted file to another directory',
						action: 'Move the targeted file to another directory',
					},
					{
						name: 'Update File',
						value: 'updateFile',
						description: 'Update the targeted file',
						action: 'Update the targeted file',
					},
					{
						name: 'Upload File',
						value: 'uploadFile',
						description: 'Upload a received file in the Twake instance in designated directory',
						action: 'Upload a received file in the twake instance in designated directory',
					},
				],
			},
			// Operation — FOLDER
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'createFolder',
				displayOptions: { show: { resource: ['folder'] } },
				options: [
					{
						name: 'Create Folder',
						value: 'createFolder',
						description:
							'Create a new directory in the Twake instance. Destination directory can be specified.',
						action: 'Create a new directory in the twake instance',
					},
					{
						name: 'Delete Folder',
						value: 'deleteFolder',
						description: 'Delete the selected directory in the Twake instance',
						action: 'Delete the selected directory in the twake instance',
					},
					{
						name: 'Move Folder',
						value: 'moveFolder',
						description: 'Move the selected folder to another directory',
						action: 'Move the selected folder to another directory',
					},
					{
						name: 'Rename Folder',
						value: 'renameFolder',
						description: 'Rename the selected folder',
						action: 'Rename the selected folder',
					},
				],
			},
			// Operation — SHARE
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'shareByLink',
				displayOptions: { show: { resource: ['share'] } },
				options: [
					{
						name: 'Delete Share (by Permissions ID)',
						value: 'deleteShare',
						description: 'Delete a share by its permissions ID (revokes all codes)',
						action: 'Delete a share by its permissions ID',
					},
					{
						name: 'Share by Link (File or Folder)',
						value: 'shareByLink',
						description: 'Create a share link for a file or a folder',
						action: 'Create a share link for a file or a folder',
					},
				],
			},

			{
				displayName: 'File or Directory ID',
				name: 'fileOrDirId',
				type: 'string',
				default: '',
				description: 'ID of the targeted file or directory',
				displayOptions: {
					show: {
						operation: ['getOneFile', 'deleteFile', 'shareByLink'],
					},
				},
			},
			{
				displayName: 'Permissions Name or ID',
				name: 'permissionsId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'loadSharePermissions',
				},
				default: '',
				required: true,
				description:
					'Select the share to delete (labels · ID). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { operation: ['deleteShare'] } },
			},
			{
				displayName: 'Revoke Only Selected Labels',
				name: 'useLabels',
				type: 'boolean',
				default: false,
				description:
					'Whether to revoke only selected labels. When disabled, the entire share is deleted.',
				displayOptions: { show: { operation: ['deleteShare'] } },
			},
			{
				displayName: 'Labels to Revoke (Optional)',
				name: 'labelsToRevoke',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'loadShareLabels',
					loadOptionsDependsOn: ['permissionsId'],
				},
				default: [],
				placeholder: 'Leave empty to delete the entire share',
				description:
					'Select labels to revoke. If empty (or switch OFF), the entire share is deleted. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { operation: ['deleteShare'], useLabels: [true] } },
			},

			{
				displayName: 'Access Level',
				name: 'accessLevel',
				type: 'options',
				default: 'read',
				options: [
					{ name: 'Read-Only', value: 'read' },
					{ name: 'Can Edit', value: 'write' },
				],
				displayOptions: { show: { operation: ['shareByLink'] } },
			},
			{
				displayName: 'Use Expiry',
				name: 'useTtl',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['shareByLink'] } },
			},
			{
				displayName: 'Expiry (Duration)',
				name: 'expiryDuration',
				type: 'fixedCollection',
				default: {},
				typeOptions: { multipleValues: false },
				displayOptions: { show: { operation: ['shareByLink'], useTtl: [true] } },
				options: [
					{
						displayName: 'Duration',
						name: 'duration',
						values: [
							{
								displayName: 'Amount',
								name: 'amount',
								type: 'number',
								default: 1,
								typeOptions: { minValue: 1 },
							},
							{
								displayName: 'Unit',
								name: 'unit',
								type: 'options',
								default: 's',
								options: [
									{ name: 'Days', value: 'D' },
									{ name: 'Hours', value: 'h' },
									{ name: 'Minutes', value: 'm' },
									{ name: 'Months', value: 'M' },
									{ name: 'Seconds', value: 's' },
									{ name: 'Years', value: 'Y' },
								],
							},
						],
					},
				],
			},

			{
				displayName: 'Protect with Password',
				name: 'usePassword',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['shareByLink'] } },
			},
			{
				displayName: 'Password',
				name: 'sharePassword',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				displayOptions: { show: { operation: ['shareByLink'], usePassword: [true] } },
			},
			{
				displayName: 'Codes (Comma-Separated Labels)',
				name: 'codes',
				type: 'string',
				default: '',
				placeholder: 'e.g. link or clientA,clientB ...',
				description:
					'Comma-separated labels; This will be the key(s) of the created codes, each creates a separate link that can be revoked independently',
				displayOptions: { show: { operation: ['shareByLink'] } },
			},

			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				description: 'ID of the targeted file',
				displayOptions: {
					show: {
						operation: ['copyFile', 'moveFile', 'updateFile'],
					},
				},
			},
			{
				displayName: 'Choose Destination Folder',
				name: 'customDir',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['copyFile', 'createFileFromText', 'moveFile', 'createFolder', 'moveFolder'],
					},
				},
			},
			{
				displayName: 'Directory ID',
				name: 'dirId',
				type: 'string',
				default: '',
				description: 'ID of the destination directory',
				displayOptions: {
					show: {
						operation: [
							'uploadFile',
							'copyFile',
							'createFileFromText',
							'moveFile',
							'createFolder',
							'moveFolder',
						],
						customDir: [true],
					},
				},
			},
			{
				displayName: 'Directory ID',
				name: 'dirId',
				type: 'string',
				default: '',
				description: 'ID of the targeted directory',
				displayOptions: {
					show: {
						operation: ['uploadFile', 'deleteFolder'],
					},
				},
			},
			{
				displayName: 'Name of the New File',
				name: 'customName',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['copyFile', 'updateFile'],
					},
				},
			},
			{
				displayName: 'New Name',
				name: 'newName',
				type: 'string',
				default: '',
				placeholder: 'file(copy).pdf',
				description: 'New name for the copied file or folder',
				displayOptions: {
					show: {
						operation: ['copyFile', 'updateFile'],
						customName: [true],
					},
				},
			},
			{
				displayName: 'New Name',
				name: 'newName',
				type: 'string',
				default: '',
				placeholder: 'myNewFile.txt',
				description: 'New name for the created file',
				displayOptions: {
					show: {
						operation: ['createFileFromText'],
					},
				},
			},
			{
				displayName: 'Text',
				name: 'textContent',
				type: 'string',
				default: '',
				description: 'Text content of the new file',
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						operation: ['createFileFromText'],
					},
				},
			},
			{
				displayName: 'Directory ID',
				name: 'listDirId',
				type: 'string',
				default: '',
				description: 'ID of the directory to list',
				displayOptions: {
					show: { operation: ['listFiles'] },
				},
			},
			{
				displayName: 'Directory Name',
				name: 'dirName',
				type: 'string',
				default: '',
				placeholder: 'My new folder',
				description: 'Name of the directory to create',
				displayOptions: {
					show: {
						operation: ['createFolder'],
					},
				},
			},
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				default: '',
				description: 'ID of the folder to move or rename',
				displayOptions: {
					show: {
						operation: ['moveFolder', 'renameFolder'],
					},
				},
			},
			{
				displayName: 'New Folder Name',
				name: 'newFolderName',
				type: 'string',
				default: '',
				placeholder: 'My renamed folder',
				description: 'New name for the folder',
				displayOptions: {
					show: {
						operation: ['renameFolder'],
					},
				},
			},
		],
	};
	methods = {
		loadOptions: {
			// Show all permissions "share-by-link" in a dropdown
			async loadSharePermissions(this: ILoadOptionsFunctions) {
				const creds = (await this.getCredentials('twakeDriveApi')) as {
					instanceUrl: string;
					apiToken: string;
				};
				const instanceUrl = creds.instanceUrl;
				const token = creds.apiToken;

				const out: Array<{ name: string; value: string }> = [];
				const seen = new Set<string>();
				let next: string | undefined;

				const headers = {
					Authorization: `Bearer ${token}`,
					Accept: 'application/vnd.api+json',
				};

				do {
					const url = next
						? new URL(next, instanceUrl).toString()
						: `${instanceUrl}/permissions/doctype/io.cozy.files/shared-by-link`;

					const resp = await this.helpers.httpRequest({ method: 'GET', url, headers, json: true });
					const data = Array.isArray(resp?.data) ? resp.data : [];

					for (const permissionEntries of data) {
						const id = String(permissionEntries?.id ?? '').trim();
						if (!id || seen.has(id)) continue;
						seen.add(id);
						const attrs: any = permissionEntries?.attributes ?? {};
						const codes =
							attrs?.codes && typeof attrs.codes === 'object' && !Array.isArray(attrs.codes)
								? (attrs.codes as Record<string, string>)
								: {};
						const shortcodes =
							attrs?.shortcodes &&
							typeof attrs.shortcodes === 'object' &&
							!Array.isArray(attrs.shortcodes)
								? (attrs.shortcodes as Record<string, string>)
								: {};
						const labels = Array.from(
							new Set([...Object.keys(shortcodes), ...Object.keys(codes)].filter(Boolean)),
						).sort();
						const name = labels.length ? `${labels.join(', ')} · ${id}` : id;
						const value = JSON.stringify({ id, codes, shortcodes });
						out.push({ name, value });
					}
					next = resp?.links?.next;
				} while (next);
				return out;
			},
			// Show list of labels of the selected "share-by-link" permission
			async loadShareLabels(this: ILoadOptionsFunctions) {
				const permParam = (this.getCurrentNodeParameter('permissionsId') as string) || '';
				if (!permParam) return [];
				let parsed: any;
				try {
					parsed = JSON.parse(permParam);
				} catch {
					// If nothing to parse, return empty, it is handle by the helpers function
					return [];
				}
				const codes =
					parsed?.codes && typeof parsed.codes === 'object' && !Array.isArray(parsed.codes)
						? (parsed.codes as Record<string, string>)
						: {};
				const shortcodes =
					parsed?.shortcodes &&
					typeof parsed.shortcodes === 'object' &&
					!Array.isArray(parsed.shortcodes)
						? (parsed.shortcodes as Record<string, string>)
						: {};
				const labels = Array.from(
					new Set([...Object.keys(shortcodes), ...Object.keys(codes)]),
				).sort();
				return labels.map((label) => ({ name: label, value: label }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		type TwakeCredentials = {
			instanceUrl: string;
			apiToken: string;
		};
		const originalCredentials = (await this.getCredentials('twakeDriveApi')) as TwakeCredentials;
		const rawInstanceUrl = originalCredentials.instanceUrl || '';
		const sanitizedInstanceUrl = rawInstanceUrl.replace(/\/+$/, '');
		const credentials: TwakeCredentials = {
			...originalCredentials,
			instanceUrl: sanitizedInstanceUrl,
		};

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const ezlog = createEzlog(items as INodeExecutionData[], itemIndex);
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				switch (operation) {
					//////////////////////
					// FILES OPERATIONS //
					//////////////////////
					case 'getOneFile':
						await TwakeFilesHelpers.getOneFile.call(this, itemIndex, ezlog, credentials);
						break;
					case 'listFiles':
						await TwakeFilesHelpers.listFiles.call(this, itemIndex, ezlog, credentials);
						break;
					case 'uploadFile':
						await TwakeFilesHelpers.uploadFile.call(this, itemIndex, items, ezlog, credentials);
						break;
					case 'copyFile':
						await TwakeFilesHelpers.copyFile.call(this, itemIndex, ezlog, credentials);
						break;
					case 'deleteFile':
						await TwakeFilesHelpers.deleteFile.call(this, itemIndex, ezlog, credentials);
						break;
					case 'createFileFromText':
						await TwakeFilesHelpers.createFileFromText.call(this, itemIndex, ezlog, credentials);
						break;
					case 'moveFile':
						await TwakeFilesHelpers.moveFile.call(this, itemIndex, ezlog, credentials);
						break;
					case 'updateFile':
						await TwakeFilesHelpers.updateFile.call(this, itemIndex, items, ezlog, credentials);
						break;
					////////////////////////////
					// DIRECTORIES OPERATIONS //
					////////////////////////////
					case 'createFolder':
						await TwakeDirectoriesHelpers.createFolder.call(
							this,
							itemIndex,
							items,
							ezlog,
							credentials,
						);
						break;
					case 'deleteFolder':
						await TwakeDirectoriesHelpers.deleteFolder.call(this, itemIndex, ezlog, credentials);
						break;
					case 'moveFolder':
						await TwakeDirectoriesHelpers.moveFolder.call(this, itemIndex, ezlog, credentials);
						break;
					case 'renameFolder':
						await TwakeDirectoriesHelpers.renameFolder.call(this, itemIndex, ezlog, credentials);
						break;
					////////////////////////
					// SHARING OPERATIONS //
					////////////////////////
					case 'shareByLink':
						await TwakeSharingHelpers.shareByLink.call(this, itemIndex, ezlog, credentials);
						break;
					case 'deleteShare':
						await TwakeSharingHelpers.deleteShareByLink.call(this, itemIndex, ezlog, credentials);
						break;
				}
			} catch (error) {
				ezlog('errorMessage', error.message);
				ezlog('errorResponse', error.response?.data || null);
				if (!this.continueOnFail()) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
			}
		}

		return [items];
	}
}
