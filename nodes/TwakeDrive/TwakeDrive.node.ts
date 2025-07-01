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
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '8a2feef6b0c5eb25892bd0a57e05b712',
				description: 'ID of the file or directory to retrieve.',
				displayOptions: {
					show: {
						operation: ['getOneFile'],
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
						token = items[itemIndex].json.realToken as string;
						await TwakeHelpers.getOneFile.call(this, itemIndex, ezlog, token);
						break;
					case 'listFiles':
						token = items[itemIndex].json.realToken as string;
						await TwakeHelpers.listFiles.call(this, itemIndex, ezlog, token);
						break;
					case 'uploadFile':
						token = items[itemIndex].json.realToken as string;
						await TwakeHelpers.uploadFile.call(this, itemIndex, ezlog, token);
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
