import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import * as TwakeFilesHelpers from './FilesHelpers/FilesHelpers';
import * as TwakeDirectoriesHelpers from './DirectoriesHelpers/DirectoriesHelpers';
import * as TwakeShareHelpers from './ShareHelpers/ShareHelpers';
import { createEzlog } from './utils/ezlog';
import { foldersLoaders, filesLoaders, shareLoaders } from './methods';
import { fileFolderProps } from './descriptions';

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
				name: 'twakeDriveOAuth2Api',
				required: true,
			},
		],
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		properties: [
			...fileFolderProps,
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'file',
				options: [
					{ name: 'File/Folder', value: 'fileFolder' },
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
				default: 'copyFile',
				displayOptions: { show: { resource: ['file'] } },
				options: [
					{
						name: 'Copy File',
						value: 'copyFile',
						description: 'Copy a file into the target directory if any',
						action: 'Copy file',
					},
					{
						name: 'Create File From Text',
						value: 'createFileFromText',
						description: 'Create a text file with provided content',
						action: 'Create file from text',
					},
					{
						name: 'Delete File',
						value: 'deleteFile',
						description: 'Delete a file by ID',
						action: 'Delete file',
					},
					{
						name: 'Move File',
						value: 'moveFile',
						description: 'Move the targeted file to another directory',
						action: 'Move file',
					},
					{
						name: 'Rename File',
						value: 'renameFile',
						description: 'Rename the targeted file',
						action: 'Rename file',
					},
					{
						name: 'Update File',
						value: 'updateFile',
						description: 'Update the targeted file',
						action: 'Update file',
					},
					{
						name: 'Upload File',
						value: 'uploadFile',
						description: 'Upload a received file in the Twake instance in designated directory',
						action: 'Upload file',
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
						action: 'Create folder',
					},
					{
						name: 'Delete Folder',
						value: 'deleteFolder',
						description: 'Delete the selected directory from the Twake instance',
						action: 'Delete folder',
					},
					{
						name: 'Move Folder',
						value: 'moveFolder',
						description: 'Move the selected folder to another directory',
						action: 'Move folder',
					},
					{
						name: 'Rename Folder',
						value: 'renameFolder',
						description: 'Rename the selected folder',
						action: 'Rename folder',
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
						action: 'Delete share',
					},
					{
						name: 'Share by Link (File or Folder)',
						value: 'shareByLink',
						description: 'Create a share link for a file or a folder',
						action: 'Create share',
					},
				],
			},
			{
				displayName: 'Target Type',
				name: 'shareTargetType',
				type: 'options',
				default: 'folder',
				options: [
					{ name: 'Folder', value: 'folder' },
					{ name: 'File', value: 'file' },
				],
				displayOptions: { show: { operation: ['shareByLink'] } },
				description: 'Choose whether to share a file or a folder',
			},
			{
				displayName: 'File Select Mode',
				name: 'fileSelectMode',
				type: 'options',
				default: 'dropdown',
				options: [
					{ name: 'Dropdown (Browse)', value: 'dropdown' },
					{ name: 'By ID (Manual)', value: 'byId' },
				],
				displayOptions: { show: { operation: ['copyFile', 'deleteFile', 'moveFile', 'renameFile', 'updateFile', 'moveFolder', 'deleteFolder', 'renameFolder', 'shareByLink'] } },
			},
			{
				displayName: 'Target Folder (Source) Name or ID',
				name: 'parentDirIdFile',
				type: 'options',
				default: '',
				description:
					'Leave empty for root. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'loadFoldersByParentSource',
					loadOptionsDependsOn: ['parentDirIdFile', 'fileSelectMode'],
				},
				displayOptions: {
					show: { operation: ['copyFile', 'deleteFile', 'moveFile', 'renameFile', 'updateFile', 'moveFolder', 'deleteFolder', 'renameFolder', 'shareByLink'], fileSelectMode: ['dropdown'] },
				},
			},
			{
				displayName: 'File (in This Folder) Name or ID',
				name: 'fileIdFromDropdown',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: '',
				typeOptions: {
					loadOptionsMethod: 'loadFilesByParent',
					loadOptionsDependsOn: ['parentDirIdFile'],
				},
				displayOptions: {
					show: { operation: ['copyFile', 'deleteFile', 'moveFile', 'renameFile', 'updateFile'], fileSelectMode: ['dropdown'] },
				},
			},
			{
				displayName: 'File (in This Folder) Name or ID',
				name: 'fileIdFromDropdownShare',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				default: '',
				typeOptions: {
					loadOptionsMethod: 'loadFilesByParent',
					loadOptionsDependsOn: ['parentDirIdFile'],
				},
				displayOptions: {
					show: { operation: ['shareByLink'], fileSelectMode: ['dropdown'], shareTargetType: ['file'] },
				},
			},
			{
				displayName: 'File ID (Manual)',
				name: 'fileIdById',
				type: 'string',
				default: '',
				placeholder: 'file-ID',
				displayOptions: { show: { operation: ['copyFile', 'deleteFile', 'moveFile', 'renameFile', 'updateFile'], fileSelectMode: ['byId'] } },
			},
			{
				displayName: 'File ID (Manual)',
				name: 'fileIdByIdShare',
				type: 'string',
				default: '',
				placeholder: 'file-ID',
				displayOptions: {
					show: { operation: ['shareByLink'], fileSelectMode: ['byId'], shareTargetType: ['file'] },
				},
			},
			{
				displayName: 'Source Folder ID (Manual)',
				name: 'sourceFolderIdById',
				type: 'string',
				default: '',
				placeholder: 'directory-ID',
				displayOptions: {
					show: { operation: ['moveFolder', 'deleteFolder', 'renameFolder'], fileSelectMode: ['byId'] },
				},
			},
			{
				displayName: 'Source Folder ID (Manual)',
				name: 'sourceFolderIdByIdShare',
				type: 'string',
				default: '',
				placeholder: 'directory-ID',
				displayOptions: {
					show: { operation: ['shareByLink'], fileSelectMode: ['byId'], shareTargetType: ['folder'] },
				},
			},
			{
				displayName: 'Destination Select Mode',
				name: 'dirSelectMode',
				type: 'options',
				default: 'dropdown',
				options: [
					{ name: 'Dropdown (Browse)', value: 'dropdown' },
					{ name: 'By ID (Manual)', value: 'byId' },
				],
				displayOptions: { show: { operation: ['copyFile', 'moveFile', 'createFileFromText', 'uploadFile', 'createFolder', 'moveFolder'] } },
			},
			{
				displayName: 'Parent Folder (Destination) Name or ID',
				name: 'parentDirIdDest',
				type: 'options',
				default: '',
				description:
					'Leave empty for root. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'loadFoldersByParentDest',
					loadOptionsDependsOn: ['parentDirIdDest', 'dirSelectMode'],
				},
				displayOptions: { show: { operation: ['copyFile', 'moveFile', 'createFileFromText', 'uploadFile', 'createFolder', 'moveFolder'], dirSelectMode: ['dropdown'] } },
			},
			{
				displayName: 'Destination Folder ID (Manual)',
				name: 'dirIdById',
				type: 'string',
				default: '',
				placeholder: 'directory-ID',
				displayOptions: { show: { operation: ['copyFile', 'moveFile', 'createFileFromText', 'uploadFile', 'createFolder', 'moveFolder'], dirSelectMode: ['byId'] } },
			},

			// SHARE DELETE inputs
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
				description: 'Whether to revoke only selected labels. When disabled, the entire share is deleted.',
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
					'Select labels to revoke. If empty (or switch OFF), the entire share is deleted. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
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
				description: 'Whether to set an expiry for the share',
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
				description: 'Whether to protect the share with a password',
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
				displayName: 'Overwrite if Exists',
				name: 'overwriteIfExists',
				type: 'boolean',
				default: false,
				description: 'Whether to overwrite a file with the same name in the destination directory',
				displayOptions: {
					show: {
						operation: ['uploadFile', 'createFileFromText'],
					},
				},
			},
			{
				displayName: 'Save as io.cozy.notes',
				name: 'saveAsNote',
				type: 'boolean',
				default: false,
				description: 'Whether to Create a Cozy Note (io.cozy.notes) instead of a plain text file',
				displayOptions: {
					show: { operation: ['createFileFromText'] },
				},
			},
			{
				displayName: 'Name of the New File',
				name: 'customName',
				type: 'boolean',
				default: false,
				description: 'Whether to set a custom name',
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
						operation: ['createFileFromText', 'renameFile'],
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
			...foldersLoaders,
			...filesLoaders,
			...shareLoaders,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const itemsOut: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const ezlog = createEzlog(items as INodeExecutionData[], itemIndex);
			const operation = this.getNodeParameter('operation', itemIndex) as string;
			try {
				switch (operation) {
					//////////////////////
					// FILES OPERATIONS //
					//////////////////////
					case 'getFileFolder': {
						await TwakeFilesHelpers.getFileFolder.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]);
						break;
					}

					case 'uploadFile': {
						await TwakeFilesHelpers.uploadFile.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]);
						break;
					}

					case 'copyFile': {
						await TwakeFilesHelpers.copyFile.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]);
						break;
					}


					case 'deleteFile': {
						await TwakeFilesHelpers.deleteFile.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]);
						break;
					}

					case 'createFileFromText': {
						await TwakeFilesHelpers.createFileFromText.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]);
						break;
					}

					case 'moveFile': {
						await TwakeFilesHelpers.moveFile.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]);
						break;
					}

					case 'updateFile': {
						await TwakeFilesHelpers.updateFile.call(this, itemIndex, items, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]); // forward item with binary
						break;
					}


					case 'renameFile': {
						await TwakeFilesHelpers.renameFile.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]); // forward item with binary
						break;
					}

					////////////////////////////
					// DIRECTORIES OPERATIONS //
					////////////////////////////
					case 'createFolder': {
						await TwakeDirectoriesHelpers.createFolder.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]); // forward item with binary
						break;
					}

					case 'deleteFolder': {
						await TwakeDirectoriesHelpers.deleteFolder.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]); // forward item with binary
						break;
					}

					case 'moveFolder': {
						await TwakeDirectoriesHelpers.moveFolder.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]); // forward item with binary
						break;
					}

					case 'renameFolder': {
						await TwakeDirectoriesHelpers.renameFolder.call(this, itemIndex, ezlog);
						const inputItems = this.getInputData();
						itemsOut.push(inputItems[itemIndex]); // forward item with binary
						break;
					}

					////////////////////////
					// SHARING OPERATIONS //
					////////////////////////
					case 'shareByLink': {
						const out = await TwakeShareHelpers.shareByLink.call(this, itemIndex, ezlog);
						itemsOut.push({ json: out });
						break;
					}

					case 'deleteShare': {
						const out = await TwakeShareHelpers.deleteShareByLink.call(this, itemIndex, ezlog);
						itemsOut.push({ json: out });
						break;
					}
				}
			} catch (error) {
				ezlog('errorMessage', (error as any).message);
				ezlog('errorResponse', (error as any).response?.data || null);
				if (!this.continueOnFail()) {
					throw new NodeOperationError(this.getNode(), error as any, { itemIndex });
				}
			}
		}

		return this.prepareOutputData(itemsOut);
	}
}
