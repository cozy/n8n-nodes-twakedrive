import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

async function loadFoldersByParent(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');

	const parentParam = String(
		(this.getCurrentNodeParameter('parentDirIdFile') as string) ??
		(this.getCurrentNodeParameter('parentDirIdDest') as string) ??
		(this.getCurrentNodeParameter('parentDirId') as string) ??
		'',
	).trim();
	const parentId = parentParam || 'io.cozy.files.root-dir';

	const out: INodePropertyOptions[] = [{ name: '🏠 Root · io.cozy.files.root-Dir', value: 'io.cozy.files.root-dir' }];

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
}

async function loadFoldersByParentSource(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');
	const parentId = (String(this.getCurrentNodeParameter('parentDirIdFile') || '').trim() || 'io.cozy.files.root-dir');

	const out: INodePropertyOptions[] = [{ name: '🏠 Root · io.cozy.files.root-Dir', value: 'io.cozy.files.root-dir' }];

	try {
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

		if (ancestors.length > 0) {
			const lastParent = ancestors[ancestors.length - 1];
			const root = ancestors.find((a) => a.id === 'io.cozy.files.root-dir');
			const keep = [root, lastParent].filter(Boolean) as Array<{ id: string; name: string }>;
			for (const a of keep) {
				const label = `⬆︎ ${a.name || a.id} · ${a.id}`;
				if (!out.some((o) => o.value === a.id)) out.push({ name: label, value: a.id });
			}
		}

		const labelCur = `📍 ${current.name || current.id} · ${current.id}`;
		if (!out.some((o) => o.value === parentId)) out.push({ name: labelCur, value: parentId });

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
}

async function loadFoldersByParentDest(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');
	const parentId = (String(this.getCurrentNodeParameter('parentDirIdDest') || '').trim() || 'io.cozy.files.root-dir');

	const out: INodePropertyOptions[] = [{ name: '🏠 Root · io.cozy.files.root-Dir', value: 'io.cozy.files.root-dir' }];

	try {
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

		if (ancestors.length > 0) {
			const lastParent = ancestors[ancestors.length - 1];
			const root = ancestors.find((a) => a.id === 'io.cozy.files.root-dir');
			const keep = [root, lastParent].filter(Boolean) as Array<{ id: string; name: string }>;
			for (const a of keep) {
				const label = `⬆︎ ${a.name || a.id} · ${a.id}`;
				if (!out.some((o) => o.value === a.id)) out.push({ name: label, value: a.id });
			}
		}

		const labelCur = `📍 ${current.name || current.id} · ${current.id}`;
		if (!out.some((o) => o.value === parentId)) out.push({ name: labelCur, value: parentId });

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
}

export const foldersLoaders = {
	loadFoldersByParent,
	loadFoldersByParentSource,
	loadFoldersByParentDest,
};
