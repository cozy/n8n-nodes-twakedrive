import type { INodeProperties } from 'n8n-workflow';

export const fileFolderProps: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getFileFolder',
		displayOptions: { show: { resource: ['fileFolder'] } },
		options: [
			{
				name: 'List Files',
				value: 'getFileFolder',
				description: 'List a folder content or fetch a single file depending on Target',
				action: 'Get files folder',
			},
		],
	},

	{
		displayName: 'Target',
		name: 'targetType',
		type: 'options',
		options: [
			{ name: 'Folder', value: 'folder' },
			{ name: 'File', value: 'file' },
		],
		default: 'folder',
		description: 'Choose whether to list a folder (its contents) or fetch a single file',
		displayOptions: { show: { resource: ['fileFolder'], operation: ['getFileFolder'] } },
	},

	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		default: 'dropdown',
		options: [
			{ name: 'Dropdown (Browse)', value: 'dropdown' },
			{ name: 'By ID (Manual)', value: 'byId' },
		],
		description: 'Browse with dropdown or paste an ID directly',
		displayOptions: { show: { resource: ['fileFolder'], operation: ['getFileFolder'] } },
	},

	{
		displayName: 'Parent Folder Name or ID',
		name: 'parentDirId',
		type: 'options',
		default: '',
		description:
			'Starting directory. Leave empty for root. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		typeOptions: {
			loadOptionsMethod: 'loadFoldersByParent',
			loadOptionsDependsOn: ['parentDirId'],
		},
		displayOptions: {
			show: { resource: ['fileFolder'], operation: ['getFileFolder'], inputMode: ['dropdown'] },
		},
	},

	{
		displayName: 'Target (in This Folder) Name or ID',
		name: 'targetId',
		type: 'options',
		default: '',
		description:
			'Select the file/folder. The value is its ID. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		typeOptions: {
			loadOptionsMethod: 'loadChildrenByParentAndType',
			loadOptionsDependsOn: ['parentDirId', 'targetType'],
		},
		displayOptions: {
			show: {
				resource: ['fileFolder'],
				operation: ['getFileFolder'],
				inputMode: ['dropdown'],
				targetType: ['file'],
			},
		},
	},

	{
		displayName: 'Target ID (Manual)',
		name: 'targetIdById',
		type: 'string',
		default: '',
		placeholder: 'file-or-directory-ID',
		description: 'Paste the target file/folder ID',
		displayOptions: {
			show: { resource: ['fileFolder'], operation: ['getFileFolder'], inputMode: ['byId'] },
		},
	},
];
