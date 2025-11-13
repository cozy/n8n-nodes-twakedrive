import type { INodeProperties } from 'n8n-workflow';

export const folderProps: INodeProperties[] = [
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
				description: 'Create a new directory in the Twake instance. Destination directory can be specified.',
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

	// Source selection (dropdown vs byId)
	{
		displayName: 'File Select Mode',
		name: 'fileSelectMode',
		type: 'options',
		default: 'dropdown',
		options: [
			{ name: 'Dropdown (Browse)', value: 'dropdown' },
			{ name: 'By ID (Manual)', value: 'byId' },
		],
		displayOptions: { show: { operation: ['moveFolder', 'deleteFolder', 'renameFolder'] } },
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
			show: { operation: ['moveFolder', 'deleteFolder', 'renameFolder'], fileSelectMode: ['dropdown'] },
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
		displayName: 'Destination Select Mode',
		name: 'dirSelectMode',
		type: 'options',
		default: 'dropdown',
		options: [
			{ name: 'Dropdown (Browse)', value: 'dropdown' },
			{ name: 'By ID (Manual)', value: 'byId' },
		],
		displayOptions: { show: { operation: ['createFolder', 'moveFolder'] } },
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
		displayOptions: { show: { operation: ['createFolder', 'moveFolder'], dirSelectMode: ['dropdown'] } },
	},

	{
		displayName: 'Destination Folder ID (Manual)',
		name: 'dirIdById',
		type: 'string',
		default: '',
		placeholder: 'directory-ID',
		displayOptions: { show: { operation: ['createFolder', 'moveFolder'], dirSelectMode: ['byId'] } },
	},

	{
		displayName: 'Directory Name',
		name: 'dirName',
		type: 'string',
		default: '',
		placeholder: 'My new folder',
		description: 'Name of the directory to create',
		displayOptions: { show: { operation: ['createFolder'] } },
	},

	{
		displayName: 'New Folder Name',
		name: 'newFolderName',
		type: 'string',
		default: '',
		placeholder: 'My renamed folder',
		description: 'New name for the folder',
		displayOptions: { show: { operation: ['renameFolder'] } },
	},
];
