import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';

function resolveDriveBase(baseUrl: string) {
	const u = new URL(baseUrl);
	const host = u.hostname;
	const parts = host.split('.');

	// drive.instance.domaine -> instance-drive.domaine
	if (parts[0] === 'drive' && parts.length >= 2) {
		const instance = parts[1];
		const rest = parts.slice(2).join('.');
		const hostname = `${instance}-drive.${rest}`;
		return `${u.protocol}//${hostname}${u.port ? ':' + u.port : ''}`;
	}

	// instance-drive.domaine -> inchangé
	if (parts[0].endsWith('-drive')) {
		return `${u.protocol}//${u.host}`;
	}

	// instance.domaine -> instance-drive.domaine
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
	const codesCsv = (this.getNodeParameter('codes', itemIndex, 'link') as string).trim();

	const verbs = accessLevel === 'write' ? ['GET', 'POST', 'PATCH', 'DELETE'] : ['GET'];

	const qs: Record<string, string> = {};
	if (codesCsv) qs.codes = codesCsv;
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

	// permissionsId vient du dropdown (payload JSON stringifié)
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
	const codesMap = (parsed.codes ?? {}) as Record<string, string>;
	const shortsMap = (parsed.shortcodes ?? {}) as Record<string, string>;

	const useLabels = this.getNodeParameter('useLabels', itemIndex, false) as boolean;
	const labels = this.getNodeParameter('labelsToRevoke', itemIndex, []) as string[] | string;
	const labelsToRevoke = (Array.isArray(labels) ? labels : [labels])
		.map((rawLabel) => String(rawLabel).trim())
		.filter(Boolean);

	// Suppression totale si OFF ou aucune étiquette fournie
	if (!useLabels || labelsToRevoke.length === 0) {
		itemBag.fullPermissionDeletion = true;
		itemBag.deletionType = !useLabels ? 'toggle_off' : 'no_labels';

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
		ezlog('deleteShareByLink', itemBag);

		return {
			deleteShare: {
				permissionsId,
				removed: 'ALL',
				remaining: [],
				status: 'deleted',
				response: delRes, // null attendu en 204
			},
		};
	}

	// Support "codes:label", "shortcodes:label" ou "label" simple
	type Target = { kind: 'codes' | 'shortcodes' | 'any'; label: string };
	const wantedLabels: Target[] = labelsToRevoke.map((val) => {
		const m = val.match(/^([a-zA-Z]+)\s*:\s*(.+)$/);
		if (m) {
			const kind = m[1].toLowerCase();
			const label = m[2].trim();
			if (kind === 'codes' || kind === 'code') return { kind: 'codes', label };
			if (kind === 'shortcodes' || kind === 'short' || kind === 'shortcode')
				return { kind: 'shortcodes', label };
		}
		return { kind: 'any', label: val };
	});

	const remainingCodes = { ...codesMap };
	const remainingShorts = { ...shortsMap };
	for (const t of wantedLabels) {
		if (t.kind === 'codes' || t.kind === 'any') delete remainingCodes[t.label];
		if (t.kind === 'shortcodes' || t.kind === 'any') delete remainingShorts[t.label];
	}

	const remaining = Array.from(
		new Set([...Object.keys(remainingCodes), ...Object.keys(remainingShorts)]),
	).sort();

	const removed = Array.from(new Set(wantedLabels.map((t) => t.label)))
		.filter((requested) => !remaining.includes(requested))
		.sort();

	if (removed.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'No matching labels to remove for this permission.',
			{ itemIndex },
		);
	}

	const patchRaw = await this.helpers.requestWithAuthentication.call(this, 'twakeDriveOAuth2Api', {
		method: 'PATCH',
		url: `${baseUrl}/permissions/${encodeURIComponent(permissionsId)}`,
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: {
			data: {
				id: permissionsId,
				type: 'io.cozy.permissions',
				attributes: {
					codes: remainingCodes,
					shortcodes: remainingShorts,
				},
			},
		},
		json: true,
	});

	const patchRes = typeof patchRaw === 'string' ? JSON.parse(patchRaw) : patchRaw;

	itemBag.fullPermissionDeletion = false;
	itemBag.deletionType = 'by_label';
	itemBag.permissionId = permissionsId;
	itemBag.revokedLabels = labelsToRevoke;
	itemBag.remainingLabels = remaining;
	itemBag.response = patchRes;
	ezlog('deleteShareByLink', itemBag);

	return {
		deleteShare: {
			permissionsId,
			removed,
			remaining,
			status: 'patched',
			response: patchRes, // untouched & parsé si besoin
		},
	};
}
