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
import { fileFolderProps, fileProps, folderProps, shareProps } from './descriptions';

export class TwakeDriveNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Twake Drive',
		name: 'twakeDriveNode',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["resource"] + " operation" }}',
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
			...fileFolderProps,
			...fileProps,
			...folderProps,
			...shareProps,
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
