import type { INodeProperties } from 'n8n-workflow';

export const fileProps: INodeProperties[] = [
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

	// Common selectors (fileSelectMode, folders, file ID)
	{
		displayName: 'File Select Mode',
		name: 'fileSelectMode',
		type: 'options',
		default: 'dropdown',
		options: [
			{ name: 'Dropdown (Browse)', value: 'dropdown' },
			{ name: 'By ID (Manual)', value: 'byId' },
		],
		displayOptions: {
			show: {
				operation: [
					'copyFile',
					'deleteFile',
					'moveFile',
					'renameFile',
					'updateFile',
				],
			},
		},
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
			show: {
				operation: [
					'copyFile',
					'deleteFile',
					'moveFile',
					'renameFile',
					'updateFile',
				],
				fileSelectMode: ['dropdown'],
			},
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
			show: {
				operation: [
					'copyFile',
					'deleteFile',
					'moveFile',
					'renameFile',
					'updateFile',
				],
				fileSelectMode: ['dropdown'],
			},
		},
	},

	{
		displayName: 'File ID (Manual)',
		name: 'fileIdById',
		type: 'string',
		default: '',
		placeholder: 'file-ID',
		displayOptions: {
			show: {
				operation: [
					'copyFile',
					'deleteFile',
					'moveFile',
					'renameFile',
					'updateFile',
				],
				fileSelectMode: ['byId'],
			},
		},
	},

	// Destination folder for operations needing a target dir
	{
		displayName: 'Destination Select Mode',
		name: 'dirSelectMode',
		type: 'options',
		default: 'dropdown',
		options: [
			{ name: 'Dropdown (Browse)', value: 'dropdown' },
			{ name: 'By ID (Manual)', value: 'byId' },
		],
		displayOptions: {
			show: {
				operation: [
					'copyFile',
					'moveFile',
					'createFileFromText',
					'uploadFile',
				],
			},
		},
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
		displayOptions: {
			show: {
				operation: [
					'copyFile',
					'moveFile',
					'createFileFromText',
					'uploadFile',
				],
				dirSelectMode: ['dropdown'],
			},
		},
	},

	{
		displayName: 'Destination Folder ID (Manual)',
		name: 'dirIdById',
		type: 'string',
		default: '',
		placeholder: 'directory-ID',
		displayOptions: {
			show: {
				operation: [
					'copyFile',
					'moveFile',
					'createFileFromText',
					'uploadFile',
				],
				dirSelectMode: ['byId'],
			},
		},
	},

	// Optional name overrides
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

	// Text content and overwrite
	{
		displayName: 'Text',
		name: 'textContent',
		type: 'string',
		default: '',
		description: 'Text content of the new file',
		typeOptions: { rows: 5 },
		displayOptions: { show: { operation: ['createFileFromText'] } },
	},

	{
		displayName: 'Overwrite if Exists',
		name: 'overwriteIfExists',
		type: 'boolean',
		default: false,
		description: 'Whether to overwrite a file with the same name in the destination directory',
		displayOptions: {
			show: { operation: ['uploadFile', 'createFileFromText'] },
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
];
