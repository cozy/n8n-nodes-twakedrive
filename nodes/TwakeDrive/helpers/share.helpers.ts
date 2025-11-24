import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';

function resolveDriveBase(baseUrl: string) {
	const u = new URL(baseUrl);
	const host = u.hostname;
	const parts = host.split('.');

	if (parts[0] === 'drive' && parts.length >= 2) {
		const instance = parts[1];
		const rest = parts.slice(2).join('.');
		const hostname = `${instance}-drive.${rest}`;
		return `${u.protocol}//${hostname}${u.port ? ':' + u.port : ''}`;
	}

	if (parts[0].endsWith('-drive')) {
		return `${u.protocol}//${u.host}`;
	}

	const instance = parts[0];
	const rest = parts.slice(1).join('.');
	const hostname = `${instance}-drive.${rest}`;
	return `${u.protocol}//${hostname}${u.port ? ':' + u.port : ''}`;
}

export async function shareByLink(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const shareTargetType = this.getNodeParameter('shareTargetType', itemIndex, 'folder') as string;
	const fileSelectMode = this.getNodeParameter('fileSelectMode', itemIndex, 'dropdown') as string;

	let id = '';
	if (fileSelectMode === 'byId') {
		if (shareTargetType === 'file') {
			id =
				((this.getNodeParameter('fileIdByIdShare', itemIndex, '') as string) || '').trim() ||
				((this.getNodeParameter('fileIdById', itemIndex, '') as string) || '').trim();
		} else {
			id =
				((this.getNodeParameter('sourceFolderIdByIdShare', itemIndex, '') as string) || '').trim() ||
				((this.getNodeParameter('sourceFolderIdById', itemIndex, '') as string) || '').trim() ||
				'io.cozy.files.root-dir';
		}
	} else {
		if (shareTargetType === 'file') {
			id =
				((this.getNodeParameter('fileIdFromDropdownShare', itemIndex, '') as string) || '').trim() ||
				((this.getNodeParameter('fileIdFromDropdown', itemIndex, '') as string) || '').trim();
		} else {
			id =
				((this.getNodeParameter('parentDirIdFile', itemIndex, '') as string) || '').trim() ||
				'io.cozy.files.root-dir';
		}
	}

	if (!id) {
		throw new NodeOperationError(this.getNode(), 'File or Directory ID is required', { itemIndex });
	}

	const accessLevel = this.getNodeParameter('accessLevel', itemIndex, 'read') as 'read' | 'write';
	const useTtl = this.getNodeParameter('useTtl', itemIndex, false) as boolean;
	const amount = this.getNodeParameter('expiryDuration.duration.amount', itemIndex, 0) as number;
	const unit = this.getNodeParameter('expiryDuration.duration.unit', itemIndex, '') as string;
	const usePassword = this.getNodeParameter('usePassword', itemIndex, false) as boolean;
	const sharePassword = (this.getNodeParameter('sharePassword', itemIndex, '') as string).trim();

	const verbs = accessLevel === 'write' ? ['GET', 'POST', 'PATCH', 'DELETE'] : ['GET'];

	const qs: Record<string, string> = {
		codes: 'code',
	};
	if (useTtl) {
		if (!amount || !unit) {
			throw new NodeOperationError(this.getNode(), 'Duration amount and unit are required', { itemIndex });
		}
		qs.ttl = `${amount}${unit}`;
	}

	const body = {
		data: {
			type: 'io.cozy.permissions',
			attributes: {
				permissions: {
					files: {
						type: 'io.cozy.files',
						values: [id],
						verbs,
					},
				},
				...(usePassword && sharePassword ? { password: sharePassword } : {}),
			},
		},
	};

	const respRaw = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
		method: 'POST',
		url: `${baseUrl}/permissions`,
		qs,
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body,
		json: true,
	});

	const resp = typeof respRaw === 'string' ? JSON.parse(respRaw) : respRaw;

	const permissionsId = resp?.data?.id ?? null;
	const shortcodes = resp?.data?.attributes?.shortcodes ?? null;

	const driveBase = resolveDriveBase(baseUrl);

	let shareUrls: Record<string, string> | null = null;
	if (shortcodes && typeof shortcodes === 'object') {
		shareUrls = {};
		for (const [label, token] of Object.entries(shortcodes as Record<string, string>)) {
			shareUrls[label] = `${driveBase}/public?sharecode=${encodeURIComponent(token)}`;
		}
	}

	itemBag.targetId = id;
	itemBag.permissionsId = permissionsId;
	itemBag.shortcodes = shortcodes;
	itemBag.shareUrls = shareUrls;
	itemBag.response = resp;
	ezlog('shareByLink', itemBag);

	return {
		shareByLink: {
			targetId: id,
			permissionsId,
			shortcodes,
			shareUrls,
			response: resp,
		},
	};
}

export async function deleteShareByLink(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
) {
	const itemBag: Record<string, any> = {};

	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as {
		instanceUrl: string;
	};
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const rawPerm = this.getNodeParameter('permissionsId', itemIndex, '') as string;
	if (!rawPerm) {
		throw new NodeOperationError(this.getNode(), 'Permissions ID is required', { itemIndex });
	}

	let parsed: any;
	try {
		parsed = JSON.parse(rawPerm);
	} catch {
		throw new NodeOperationError(
			this.getNode(),
			'Invalid permission payload. Select an item from the dropdown.',
			{ itemIndex },
		);
	}

	const permissionsId = String(parsed.id || '');
	if (!permissionsId) {
		throw new NodeOperationError(this.getNode(), 'Invalid permission ID', { itemIndex });
	}

	const delRaw = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
		method: 'DELETE',
		url: `${baseUrl}/permissions/${encodeURIComponent(permissionsId)}`,
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/json',
		},
		json: true,
	});

	const delRes =
		typeof delRaw === 'string'
			? delRaw.trim().length
				? JSON.parse(delRaw)
				: null
			: (delRaw ?? null);

	itemBag.deletedPermissionId = permissionsId;
	itemBag.response = delRes;
	itemBag.fullPermissionDeletion = true;
	itemBag.deletionType = 'full';
	ezlog('deleteShareByLink', itemBag);

	return {
		deleteShare: {
			permissionsId,
			removed: 'ALL',
			remaining: [],
			status: 'deleted',
			response: delRes,
		},
	};
}
