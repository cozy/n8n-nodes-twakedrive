import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodePropertyOptions,
	INodeTypeDescription,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import * as TwakeFilesHelpers from './FilesHelpers/FilesHelpers';
import * as TwakeDirectoriesHelpers from './DirectoriesHelpers/DirectoriesHelpers';
import * as TwakeShareHelpers from './ShareHelpers/ShareHelpers';
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
			// Operation — FILE/FOLDER
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
					show: { resource: ['fileFolder'], operation: ['getFileFolder'], inputMode: ['dropdown'], targetType: ['file'] },
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
			async loadSharePermissions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
					instanceUrl: string;
				};
				const baseUrl: string = (instanceUrl || '').replace(/\/+$/, '');

				const out: INodePropertyOptions[] = [];
				const seen: Set<string> = new Set();
				let next: string | undefined = undefined;

				do {
					const url: string = next
						? new URL(next, baseUrl).toString()
						: `${baseUrl}/permissions/doctype/io.cozy.files/shared-by-link`;

					const respRaw: unknown = await this.helpers.requestWithAuthentication.call(
						this,
						'twakeDriveOAuth2Api',
						{
							method: 'GET',
							url,
							headers: { Accept: 'application/vnd.api+json' },
							json: true,
						},
					);

					const resp: any =
						typeof respRaw === 'string' ? JSON.parse(respRaw as string) : (respRaw as any);

					const data: any[] = Array.isArray(resp?.data) ? resp.data : [];

					for (const permissionEntry of data) {
						const id: string = String(permissionEntry?.id ?? '').trim();
						if (!id || seen.has(id)) continue;
						seen.add(id);

						const attrs: any = permissionEntry?.attributes ?? {};
						const codes: Record<string, string> =
							attrs?.codes && typeof attrs.codes === 'object' && !Array.isArray(attrs.codes)
								? (attrs.codes as Record<string, string>)
								: {};
						const shortcodes: Record<string, string> =
							attrs?.shortcodes &&
								typeof attrs.shortcodes === 'object' &&
								!Array.isArray(attrs.shortcodes)
								? (attrs.shortcodes as Record<string, string>)
								: {};

						const labels: string[] = Array.from(
							new Set([...Object.keys(shortcodes), ...Object.keys(codes)].filter(Boolean)),
						).sort();

						const name: string = labels.length ? `${labels.join(', ')} · ${id}` : id;
						const value: string = JSON.stringify({ id, codes, shortcodes });

						out.push({ name, value });
					}

					next = (resp?.links?.next as string | undefined) || undefined;
				} while (next);

				return out;
			},

			async loadShareLabels(this: ILoadOptionsFunctions) {
				const permParam = (this.getCurrentNodeParameter('permissionsId') as string) || '';
				if (!permParam) return [];

				let parsed: any;
				try {
					parsed = JSON.parse(permParam);
				} catch {
					return [];
				}

				const codes =
					parsed?.codes && typeof parsed.codes === 'object' && !Array.isArray(parsed.codes)
						? (parsed.codes as Record<string, string>)
						: {};
				const shortcodes =
					parsed?.shortcodes &&
						typeof parsed.shortcodes === 'object' &&
						!Array.isArray(parsed.shortcodes)
						? (parsed.shortcodes as Record<string, string>)
						: {};

				const labels = Array.from(
					new Set([...Object.keys(shortcodes), ...Object.keys(codes)]),
				).sort();
				return labels.map((label) => ({ name: label, value: label }));
			},

			// Root: 🏠 | parents: "⬆︎" | Current :📍 | Child : "↳ 📁"
			async loadFoldersByParent(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
					instanceUrl: string;
				};
				const baseUrl = instanceUrl.replace(/\/+$/, '');

				const parentParam = String(
					(this.getCurrentNodeParameter('parentDirIdFile') as string) ??
					(this.getCurrentNodeParameter('parentDirIdDest') as string) ??
					(this.getCurrentNodeParameter('parentDirId') as string) ??
					'',
				).trim();
				const parentId = parentParam || 'io.cozy.files.root-dir';

				const out: INodePropertyOptions[] = [
					{ name: '🏠 Root · io.cozy.files.root-Dir', value: 'io.cozy.files.root-dir' },
				];

				try {
					let ancestors: Array<{ id: string; name: string }> = [];
					let current: { id: string; name: string } = {
						id: parentId,
						name: parentId === 'io.cozy.files.root-dir' ? 'root' : '',
					};

					if (parentId !== 'io.cozy.files.root-dir') {
						const chain: Array<{ id: string; name: string }> = [];
						let currentId: string | null = parentId;

						while (currentId && currentId !== 'io.cozy.files.root-dir') {
							const selfRespRaw: unknown = await this.helpers.requestWithAuthentication.call(
								this,
								'twakeDriveOAuth2Api',
								{
									method: 'GET',
									baseURL: baseUrl,
									url: `/files/${encodeURIComponent(currentId)}`,
									headers: { Accept: 'application/vnd.api+json' },
									json: true,
								} as any,
							);
							const selfResp: any = typeof selfRespRaw === 'string' ? JSON.parse(selfRespRaw) : selfRespRaw;
							const selfData: any = (selfResp as any)?.data ?? selfResp;
							const selfName = String(selfData?.attributes?.name ?? '');
							chain.push({ id: String(currentId), name: selfName });

							const parentOfSelf: string | undefined =
								typeof selfData?.attributes?.dir_id === 'string' ? selfData.attributes.dir_id : undefined;
							if (!parentOfSelf || parentOfSelf === currentId) break;
							currentId = parentOfSelf;
						}

						const chainFromRoot = chain.slice().reverse();
						if (chainFromRoot.length > 0) {
							current = chainFromRoot[chainFromRoot.length - 1];
							ancestors = chainFromRoot.slice(0, -1);
						}
					}

					for (const a of ancestors) {
						if (a.id === 'io.cozy.files.root-dir') continue;
						const label = `⬆︎ ${a.name || a.id} · ${a.id}`;
						if (!out.some((o) => o.value === a.id)) out.push({ name: label, value: a.id });
					}

					{
						const labelCur = `📍 ${current.name || current.id} · ${current.id}`;
						if (!out.some((o) => o.value === parentId)) out.push({ name: labelCur, value: parentId });
					}

					const children: Array<{ id: string; name: string }> = [];
					let cursor: string | null = null;

					while (true) {
						const qs: Record<string, string | number> = { 'page[limit]': 30 };
						if (cursor) qs['page[cursor]'] = cursor;

						const resp = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
							method: 'GET',
							baseURL: baseUrl,
							url: `/files/${encodeURIComponent(parentId)}`,
							qs,
							headers: { Accept: 'application/vnd.api+json' },
							json: true,
						} as any);

						const chunk = Array.isArray((resp as any)?.included) ? (resp as any).included : [];
						for (const it of chunk) {
							const id = String(it?.id || '');
							const attrs = it?.attributes || {};
							if (id && String(attrs?.type || '') === 'directory') {
								const nm = String(attrs?.name || '');
								children.push({ id, name: nm });
							}
						}

						const nextPageLink = (resp as any)?.links?.next as string | undefined;
						cursor = nextPageLink ? new URL(nextPageLink, baseUrl).searchParams.get('page[cursor]') : null;
						if (!cursor) break;
					}

					children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
					for (const c of children) out.push({ name: `↳ 📁 ${c.name} · ${c.id}`, value: c.id });

					return out;
				} catch (err: any) {
					const status = err?.statusCode || err?.response?.status || 'unknown';
					const detail = err?.response?.data || err?.message || err;
					throw new NodeOperationError(
						this.getNode(),
						`loadFoldersByParent: GET /files/${parentId} failed (HTTP ${status}) · ${JSON.stringify(detail)}`,
					);
				}
			},

			async loadFoldersByParentSource(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
				const baseUrl = instanceUrl.replace(/\/+$/, '');
				const parentId = (String(this.getCurrentNodeParameter('parentDirIdFile') || '').trim() || 'io.cozy.files.root-dir');

				const out: INodePropertyOptions[] = [{ name: '🏠 Root · io.cozy.files.root-Dir', value: 'io.cozy.files.root-dir' }];

				try {
					// build ancestors + current
					let ancestors: Array<{ id: string; name: string }> = [];
					let current: { id: string; name: string } = {
						id: parentId,
						name: parentId === 'io.cozy.files.root-dir' ? 'root' : '',
					};

					if (parentId !== 'io.cozy.files.root-dir') {
						const chain: Array<{ id: string; name: string }> = [];
						let cur: string | null = parentId;

						while (cur && cur !== 'io.cozy.files.root-dir') {
							const selfRespRaw: any = await (this as any).helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
								method: 'GET',
								baseURL: baseUrl,
								url: `/files/${encodeURIComponent(cur)}`,
								headers: { Accept: 'application/vnd.api+json' },
								json: true,
							});
							const selfData = (typeof selfRespRaw === 'string' ? JSON.parse(selfRespRaw) : selfRespRaw)?.data ?? selfRespRaw;
							const name = String(selfData?.attributes?.name ?? '');
							chain.push({ id: String(cur), name });

							const parentOfSelf: string | undefined = typeof selfData?.attributes?.dir_id === 'string' ? selfData.attributes.dir_id : undefined;
							if (!parentOfSelf || parentOfSelf === cur) break;
							cur = parentOfSelf;
						}

						const chainFromRoot = chain.slice().reverse();
						if (chainFromRoot.length > 0) {
							current = chainFromRoot[chainFromRoot.length - 1];
							ancestors = chainFromRoot.slice(0, -1);
						}
					}

					// ancestors (keep only root and last parent)
					if (ancestors.length > 0) {
						const lastParent = ancestors[ancestors.length - 1];
						const root = ancestors.find((a) => a.id === 'io.cozy.files.root-dir');
						const keep = [root, lastParent].filter(Boolean) as Array<{ id: string; name: string }>;
						for (const a of keep) {
							const label = `⬆︎ ${a.name || a.id} · ${a.id}`;
							if (!out.some((o) => o.value === a.id)) out.push({ name: label, value: a.id });
						}
					}

					// current (avoid “value not supported”)
					const labelCur = `📍 ${current.name || current.id} · ${current.id}`;
					if (!out.some((o) => o.value === parentId)) out.push({ name: labelCur, value: parentId });

					// children (go down)
					const children: Array<{ id: string; name: string }> = [];
					let cursor: string | null = null;

					while (true) {
						const qs: Record<string, string | number> = { 'page[limit]': 30 };
						if (cursor) qs['page[cursor]'] = cursor;

						const resp: any = await (this as any).helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
							method: 'GET',
							baseURL: baseUrl,
							url: `/files/${encodeURIComponent(parentId)}`,
							qs,
							headers: { Accept: 'application/vnd.api+json' },
							json: true,
						});

						const chunk = Array.isArray(resp?.included) ? resp.included : [];
						for (const it of chunk) {
							const id = String(it?.id || '');
							const attrs = it?.attributes || {};
							if (id && String(attrs?.type || '') === 'directory') {
								const nm = String(attrs?.name || '');
								children.push({ id, name: nm });
							}
						}

						const nextPageLink = resp?.links?.next as string | undefined;
						cursor = nextPageLink ? new URL(nextPageLink, baseUrl).searchParams.get('page[cursor]') : null;
						if (!cursor) break;
					}

					children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
					for (const c of children) out.push({ name: `↳ 📁 ${c.name} · ${c.id}`, value: c.id });

					return out;
				} catch (err: any) {
					const status = err?.statusCode || err?.response?.status || 'unknown';
					const detail = err?.response?.data || err?.message || err;
					throw new NodeOperationError(
						this.getNode(),
						`loadFoldersByParentSource: GET /files/${parentId} failed (HTTP ${status}) · ${JSON.stringify(detail)}`,
					);
				}
			},

			async loadFoldersByParentDest(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
				const baseUrl = instanceUrl.replace(/\/+$/, '');
				const parentId = (String(this.getCurrentNodeParameter('parentDirIdDest') || '').trim() || 'io.cozy.files.root-dir');

				const out: INodePropertyOptions[] = [{ name: '🏠 Root · io.cozy.files.root-Dir', value: 'io.cozy.files.root-dir' }];

				try {
					// build ancestors + current
					let ancestors: Array<{ id: string; name: string }> = [];
					let current: { id: string; name: string } = {
						id: parentId,
						name: parentId === 'io.cozy.files.root-dir' ? 'root' : '',
					};

					if (parentId !== 'io.cozy.files.root-dir') {
						const chain: Array<{ id: string; name: string }> = [];
						let cur: string | null = parentId;

						while (cur && cur !== 'io.cozy.files.root-dir') {
							const selfRespRaw: any = await (this as any).helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
								method: 'GET',
								baseURL: baseUrl,
								url: `/files/${encodeURIComponent(cur)}`,
								headers: { Accept: 'application/vnd.api+json' },
								json: true,
							});
							const selfData = (typeof selfRespRaw === 'string' ? JSON.parse(selfRespRaw) : selfRespRaw)?.data ?? selfRespRaw;
							const name = String(selfData?.attributes?.name ?? '');
							chain.push({ id: String(cur), name });

							const parentOfSelf: string | undefined = typeof selfData?.attributes?.dir_id === 'string' ? selfData.attributes.dir_id : undefined;
							if (!parentOfSelf || parentOfSelf === cur) break;
							cur = parentOfSelf;
						}

						const chainFromRoot = chain.slice().reverse();
						if (chainFromRoot.length > 0) {
							current = chainFromRoot[chainFromRoot.length - 1];
							ancestors = chainFromRoot.slice(0, -1);
						}
					}

					// ancestors (keep only root and last parent)
					if (ancestors.length > 0) {
						const lastParent = ancestors[ancestors.length - 1];
						const root = ancestors.find((a) => a.id === 'io.cozy.files.root-dir');
						const keep = [root, lastParent].filter(Boolean) as Array<{ id: string; name: string }>;
						for (const a of keep) {
							const label = `⬆︎ ${a.name || a.id} · ${a.id}`;
							if (!out.some((o) => o.value === a.id)) out.push({ name: label, value: a.id });
						}
					}

					// current (avoid “value not supported”)
					const labelCur = `📍 ${current.name || current.id} · ${current.id}`;
					if (!out.some((o) => o.value === parentId)) out.push({ name: labelCur, value: parentId });

					// children (go down)
					const children: Array<{ id: string; name: string }> = [];
					let cursor: string | null = null;

					while (true) {
						const qs: Record<string, string | number> = { 'page[limit]': 30 };
						if (cursor) qs['page[cursor]'] = cursor;

						const resp: any = await (this as any).helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
							method: 'GET',
							baseURL: baseUrl,
							url: `/files/${encodeURIComponent(parentId)}`,
							qs,
							headers: { Accept: 'application/vnd.api+json' },
							json: true,
						});

						const chunk = Array.isArray(resp?.included) ? resp.included : [];
						for (const it of chunk) {
							const id = String(it?.id || '');
							const attrs = it?.attributes || {};
							if (id && String(attrs?.type || '') === 'directory') {
								const nm = String(attrs?.name || '');
								children.push({ id, name: nm });
							}
						}

						const nextPageLink = resp?.links?.next as string | undefined;
						cursor = nextPageLink ? new URL(nextPageLink, baseUrl).searchParams.get('page[cursor]') : null;
						if (!cursor) break;
					}

					children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
					for (const c of children) out.push({ name: `↳ 📁 ${c.name} · ${c.id}`, value: c.id });

					return out;
				} catch (err: any) {
					const status = err?.statusCode || err?.response?.status || 'unknown';
					const detail = err?.response?.data || err?.message || err;
					throw new NodeOperationError(
						this.getNode(),
						`loadFoldersByParentDest: GET /files/${parentId} failed (HTTP ${status}) · ${JSON.stringify(detail)}`,
					);
				}
			},

			// List files of a parent directory (for source file selection)
			async loadFilesByParent(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
					instanceUrl: string;
				};
				const baseUrl = instanceUrl.replace(/\/+$/, '');
				const parentParam = String(this.getCurrentNodeParameter('parentDirIdFile') || '').trim();
				const parentId = parentParam || 'io.cozy.files.root-dir';

				const entries: Array<{ id: string; name: string }> = [];
				let cursor: string | null = null;

				while (true) {
					const qs: Record<string, string | number> = { 'page[limit]': 30 };
					if (cursor) qs['page[cursor]'] = cursor;

					const resp = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
						method: 'GET',
						baseURL: baseUrl,
						url: `/files/${encodeURIComponent(parentId)}`,
						qs,
						headers: { Accept: 'application/vnd.api+json' },
						json: true,
					} as any);

					const chunk = Array.isArray((resp as any)?.included) ? (resp as any).included : [];
					for (const it of chunk) {
						const id = String(it?.id || '');
						const attrs = it?.attributes || {};
						if (id && String(attrs?.type || '') !== 'directory') {
							const nm = String(attrs?.name || attrs?.filename || '');
							entries.push({ id, name: nm });
						}
					}

					const nextPageLink = (resp as any)?.links?.next as string | undefined;
					cursor = nextPageLink ? new URL(nextPageLink, baseUrl).searchParams.get('page[cursor]') : null;
					if (!cursor) break;
				}

				entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
				return entries.map((e) => ({ name: `📄 ${e.name} · ${e.id}`, value: e.id }));
			},
			// Children of parent filtered by targetType (folder|file)
			async loadChildrenByParentAndType(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
				const baseUrl = instanceUrl.replace(/\/+$/, '');

				const parentParam = String(this.getCurrentNodeParameter('parentDirId') || '').trim();
				const parentId = parentParam || 'io.cozy.files.root-dir';

				const targetType = String(this.getCurrentNodeParameter('targetType') || 'folder');
				const wantFolder = targetType === 'folder';

				const out: INodePropertyOptions[] = [];
				let cursor: string | null = null;

				while (true) {
					const qs: Record<string, string | number> = { 'page[limit]': 30 };
					if (cursor) qs['page[cursor]'] = cursor;

					const resp: any = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
						method: 'GET',
						baseURL: baseUrl,
						url: `/files/${encodeURIComponent(parentId)}`,
						qs,
						headers: { Accept: 'application/vnd.api+json' },
						json: true,
					});

					const chunk = Array.isArray(resp?.included) ? resp.included : [];
					for (const it of chunk) {
						const id = String(it?.id || '');
						if (!id) continue;
						const attrs = it?.attributes || {};
						const isDir = String(attrs?.type || '') === 'directory';
						if (wantFolder && isDir) {
							const nm = String(attrs?.name || '');
							out.push({ name: `📁 ${nm} · ${id}`, value: id });
						} else if (!wantFolder && !isDir) {
							const nm = String(attrs?.name || attrs?.filename || '');
							out.push({ name: `📄 ${nm} · ${id}`, value: id });
						}
					}

					const nextPageLink = resp?.links?.next as string | undefined;
					cursor = nextPageLink ? new URL(nextPageLink, baseUrl).searchParams.get('page[cursor]') : null;
					if (!cursor) break;
				}

				out.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
				return out;
			}

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
