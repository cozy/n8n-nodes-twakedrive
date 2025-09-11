import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';

export async function shareByLink(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const instanceUrl = credentials.instanceUrl;
	const realToken = credentials.apiToken;

	const id = this.getNodeParameter('targetId', itemIndex, '') as string;
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
	if (codesCsv) qs['codes'] = codesCsv;
	if (useTtl) {
		if (!amount || !unit) {
			throw new NodeOperationError(this.getNode(), 'Duration amount and unit are required', {
				itemIndex,
			});
		}
		qs['ttl'] = `${amount}${unit}`;
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

	try {
		const resp = await this.helpers.httpRequest({
			method: 'POST',
			url: `${instanceUrl}/permissions`,
			qs,
			headers: {
				Authorization: `Bearer ${realToken}`,
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/vnd.api+json',
			},
			body,
			json: true,
		});

		const permissionsId = resp?.data?.id ?? null;
		const shortcodes = resp?.data?.attributes?.shortcodes ?? null;
		const u = new URL(instanceUrl);
		const driveBase = `${u.protocol}//drive.${u.host}`;
		const shareUrls: Record<string, string> = {};
		if (shortcodes && typeof shortcodes === 'object') {
			for (const [label, personalToken] of Object.entries(shortcodes as Record<string, string>)) {
				shareUrls[label] = `${driveBase}/public?sharecode=${personalToken}`;
			}
		}
		ezlog('share.urls', shareUrls);
		ezlog('share.permissionsId', permissionsId);

		return { share: { permissionsId, shareUrls } };
	} catch (error: any) {
		throw new NodeOperationError(this.getNode(), error, { itemIndex });
	}
}

export async function deleteShareByLink(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const { instanceUrl, apiToken } = credentials;
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

	// Full permission deletion (labels OFF or no label specified)
	if (!useLabels || labelsToRevoke.length === 0) {
		await this.helpers.httpRequest({
			method: 'DELETE',
			url: `${instanceUrl}/permissions/${encodeURIComponent(permissionsId)}`,
			headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/vnd.api+json' },
			json: true,
		});
		ezlog('deletedPermission', {
			permissionsId,
			type: !useLabels ? 'toggle_off' : 'no_labels',
		});
		return { permissionsId, removed: 'ALL', remaining: [], status: 'deleted' };
	}

	// codes|shortcodes|solo string support
	type Target = { kind: 'codes' | 'shortcodes' | 'any'; label: string };
	const wantedLabels: Target[] = labelsToRevoke.map((val) => {
		const prefixLabelMatch = val.match(/^([a-zA-Z]+)\s*:\s*(.+)$/);
		if (prefixLabelMatch) {
			const kind = prefixLabelMatch[1].toLowerCase();
			const label = prefixLabelMatch[2].trim();
			if (kind === 'codes' || kind === 'code') return { kind: 'codes', label };
			if (kind === 'shortcodes' || kind === 'short' || kind === 'shortcode')
				return { kind: 'shortcodes', label };
		}
		return { kind: 'any', label: val };
	});
	const remainingCodes = { ...codesMap };
	const remainingShorts = { ...shortsMap };
	for (const wantedLabel of wantedLabels) {
		if (wantedLabel.kind === 'codes' || wantedLabel.kind === 'any')
			delete remainingCodes[wantedLabel.label];
		if (wantedLabel.kind === 'shortcodes' || wantedLabel.kind === 'any')
			delete remainingShorts[wantedLabel.label];
	}
	const remaining = Array.from(
		new Set([...Object.keys(remainingCodes), ...Object.keys(remainingShorts)]),
	).sort();
	const removed = Array.from(
		new Set(wantedLabels.map((revocationTarget) => revocationTarget.label)),
	)
		.filter((requestedLabel) => !remaining.includes(requestedLabel))
		.sort();
	if (removed.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'No matching labels to remove for this permission.',
			{ itemIndex },
		);
	}

	// Permission deletion for specified label(s)
	await this.helpers.httpRequest({
		method: 'PATCH',
		url: `${instanceUrl}/permissions/${encodeURIComponent(permissionsId)}`,
		headers: {
			Authorization: `Bearer ${apiToken}`,
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
	ezlog('revokedLabels', { permissionsId, labelsToRevoke, removed, remaining, useLabels: true });
	return { permissionsId, removed, remaining, status: 'patched' };
}
