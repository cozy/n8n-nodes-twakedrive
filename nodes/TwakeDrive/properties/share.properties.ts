import type { INodeProperties } from 'n8n-workflow';

export const shareProps: INodeProperties[] = [
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
		displayOptions: { show: { operation: ['shareByLink'] } },
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
		displayOptions: { show: { operation: ['shareByLink'], fileSelectMode: ['dropdown'] } },
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
		name: 'sourceFolderIdByIdShare',
		type: 'string',
		default: '',
		placeholder: 'directory-ID',
		displayOptions: {
			show: { operation: ['shareByLink'], fileSelectMode: ['byId'], shareTargetType: ['folder'] },
		},
	},

	{
		displayName: 'Permissions Name or ID',
		name: 'permissionsId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'loadSharePermissions' },
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
					{ displayName: 'Amount', name: 'amount', type: 'number', default: 1, typeOptions: { minValue: 1 } },
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
];
