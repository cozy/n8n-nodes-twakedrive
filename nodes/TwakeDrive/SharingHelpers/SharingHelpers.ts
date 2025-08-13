import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';

export async function shareByLink(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	credentials: { instanceUrl: string; apiToken: string },
) {
	const instanceUrl = credentials.instanceUrl;
	const realToken = credentials.apiToken;

	const id = this.getNodeParameter('fileOrDirId', itemIndex, '') as string;
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
