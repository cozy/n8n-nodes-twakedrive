import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import * as TwakeFilesHelpers from './FilesHelpers/FilesHelpers';

export class TwakeDrive implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Twake Drive',
		name: 'exampleNode',
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
				options: [
					{
						name: 'Get Real Token',
						value: 'getRealToken',
						description: 'Obtain the real token from Twake permissions endpoint.',
					},
					{
						name: 'Get One File',
						value: 'getOneFile',
						description: 'Retrieve a single file or directory by ID.',
					},
					{
						name: 'List Files',
						value: 'listFiles',
						description: 'List all files in the Twake instance.',
					},
					{
						name: 'Upload File',
						value: 'uploadFile',
						description: 'Upload a receveid file in the Twake instance in designated directory',
					},
					{
						name: 'Copy File',
						value: 'copyFile',
						description:
							'Copy the selected file in the Twake instance in the targeted directory if any',
					},
					{
						name: 'Delete File',
						value: 'deleteFile',
						description: 'Delete the selected file in the Twake instance',
					},
					{
						name: 'Create file from text',
						value: 'createFileFromText',
						description: 'Create a new text file with given text',
					},
					{
						name: 'Move File',
						value: 'moveFile',
						description: 'Move the targeted file to another directory',
					},
					{
						name: 'Update File',
						value: 'updateFile',
						description: 'Update the targeted file',
					},
				],
				default: 'listFiles',
				description: 'Operation to perform.',
			},

			{
				displayName: 'Instance URL',
				name: 'instanceUrl',
				type: 'string',
				default: 'http://devccc.192-168-1-41.nip.io:8080',
				placeholder: 'https://my-twake-instance.com',
				description: 'Base URL of the Twake instance.',
			},

			{
				displayName: 'Real Token',
				name: 'realToken',
				type: 'string',
				default: '',
				description: 'Token used to access Twake API.',
				displayOptions: {
					show: {
						operation: ['getOneFile', 'listFiles', 'copyFile', 'createFileFromText'],
					},
				},
			},

			{
				displayName: 'File or Directory ID',
				name: 'fileOrDirId',
				type: 'string',
				default: 'e863001c7182d8ee4f791a71fd379559',
				description: 'ID of the targeted file or directory.',
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
				default: 'e863001c7182d8ee4f791a71fd379559',
				description: 'ID of the targeted file.',
				displayOptions: {
					show: {
						operation: ['uploadFile', 'copyFile', 'moveFile', 'updateFile'],
					},
				},
			},

			{
				displayName: 'Choose destination folder',
				name: 'customDir',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						operation: ['copyFile', 'createFileFromText', 'moveFile'],
					},
				},
			},

			{
				displayName: 'Directory ID',
				name: 'dirId',
				type: 'string',
				default: '03feda4a1b0d82e0cf637a2bcb00acfd',
				description: 'ID of the targeted directory.',
				displayOptions: {
					show: {
						operation: ['copyFile', 'createFileFromText', 'moveFile'],
						customDir: [true],
					},
				},
			},

			{
				displayName: 'Name of the new file',
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
				description: 'New name for the copied file or folder.',
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
				description: 'Text content of the new file.',
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						operation: ['createFileFromText'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('twakeDriveApi');

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			function saveItem(items: any, itemIndex: any) {
				return function (name: string, value: any) {
					items[itemIndex].json[name] = value;
				};
			}
			const ezlog = saveItem(items, itemIndex);
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let token;

				switch (operation) {
					case 'getRealToken':
						token = credentials.apiToken as string;
						await TwakeFilesHelpers.getRealToken.call(this, itemIndex, ezlog, token);
						break;
					// FILES OPERATIONS
					case 'getOneFile':
						await TwakeFilesHelpers.getOneFile.call(this, itemIndex, items, ezlog);
						break;
					case 'listFiles':
						await TwakeFilesHelpers.listFiles.call(this, itemIndex, items, ezlog);
						break;
					case 'uploadFile':
						await TwakeFilesHelpers.uploadFile.call(this, itemIndex, items, ezlog);
						break;
					case 'copyFile':
						await TwakeFilesHelpers.copyFile.call(this, itemIndex, items, ezlog);
						break;
					case 'deleteFile':
						await TwakeFilesHelpers.deleteFile.call(this, itemIndex, items, ezlog);
						break;
					case 'createFileFromText':
						await TwakeFilesHelpers.createFileFromText.call(this, itemIndex, items, ezlog);
						break;
					case 'moveFile':
						await TwakeFilesHelpers.moveFile.call(this, itemIndex, items, ezlog);
						break;
					case 'updateFile':
						await TwakeFilesHelpers.updateFile.call(this, itemIndex, items, ezlog);
						break;
				}
			} catch (error) {
				items[itemIndex].json.errorMessage = error.message;
				items[itemIndex].json.errorResponse = error.response?.data || null;
				items[itemIndex].json.instanceUrl = this.getNodeParameter(
					'instanceUrl',

					itemIndex,

					'',
				) as string;

				if (!this.continueOnFail()) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
			}
		}

		return [items];
	}
}
