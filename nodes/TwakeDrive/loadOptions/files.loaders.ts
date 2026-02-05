import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { twakeDriveRequest } from '../helpers/request.helpers';

async function loadFilesByParent(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
	const baseUrl = instanceUrl.replace(/\/+$/, '');
	const parentParam = String(this.getCurrentNodeParameter('parentDirIdFile') || '').trim();
	const parentId = parentParam || 'io.cozy.files.root-dir';

	const entries: Array<{ id: string; name: string }> = [];
	let cursor: string | null = null;

	while (true) {
		const qs: Record<string, string | number> = { 'page[limit]': 30 };
		if (cursor) qs['page[cursor]'] = cursor;

		const resp = await twakeDriveRequest.call(this, {
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
}

async function loadChildrenByParentAndType(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
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

		const resp: any = await twakeDriveRequest.call(this, {
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

export const filesLoaders = {
	loadFilesByParent,
	loadChildrenByParentAndType,
};
