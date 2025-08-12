import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import * as TwakeFilesHelpers from './FilesHelpers/FilesHelpers';
import * as TwakeDirectoriesHelpers from './DirectoriesHelpers/DirectoriesHelpers';
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					// FILES OPERATIONS
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
						action: 'List all files in the twake instance',
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
					// DIRECTORIES OPERATION
					{
						name: 'Create Folder',
						value: 'createFolder',
						description:
							'Create a new directory in the Twake instance. Destination directory can be specified',
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

				default: 'listFiles',
			},
			{
				displayName: 'File or Directory ID',
				name: 'fileOrDirId',
				type: 'string',
				default: '',
				description: 'ID of the targeted file or directory',
				displayOptions: {
					show: {
						operation: ['getOneFile', 'deleteFile'],
					},
				},
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
				description: 'ID of the targeted directory',
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		type TwakeCredentials = {
			instanceUrl: string;
			apiToken: string;
		};
		const credentials = (await this.getCredentials('twakeDriveApi')) as TwakeCredentials;

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
						await TwakeFilesHelpers.listFiles.call(this, ezlog, credentials);
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
