import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import * as TwakeHelpers from './TwakeHelpers';

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
						operation: ['getOneFile', 'listFiles'],
					},
				},
			},

			{
				displayName: 'File or directory ID',
				name: 'fileId',
				type: 'string',
				default: 'e863001c7182d8ee4f791a71fd009f33',
				description: 'ID of the targeted file or directory.',
				displayOptions: {
					show: {
						operation: ['getOneFile', 'uploadFile'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('twakeDriveApi');

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			function n8nLogger(items: any, itemIndex: any) {
				return function (name: string, value: any) {
					items[itemIndex].json[name] = value;
				};
			}
			const ezlog = n8nLogger(items, itemIndex);
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let token;

				switch (operation) {
					case 'getRealToken':
						token = credentials.apiToken as string;
						await TwakeHelpers.getRealToken.call(this, itemIndex, ezlog, token);
						break;

					case 'getOneFile':
						await TwakeHelpers.getOneFile.call(this, itemIndex, items, ezlog);
						break;
					case 'listFiles':
						await TwakeHelpers.listFiles.call(this, itemIndex, items, ezlog);
						break;
					case 'uploadFile':
						await TwakeHelpers.uploadFile.call(this, itemIndex, items, ezlog);
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
