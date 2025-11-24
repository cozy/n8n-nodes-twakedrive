import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

async function loadSharePermissions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	try {
		const { instanceUrl } = (await this.getCredentials('twakeDriveOAuth2Api')) as { instanceUrl: string };
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

			const resp: any = typeof respRaw === 'string' ? JSON.parse(respRaw as string) : (respRaw as any);
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
	} catch (err: any) {
		const status = err?.statusCode || err?.response?.status || 'unknown';
		const detail = err?.response?.data || err?.message || err;
		throw new NodeOperationError(
			this.getNode(),
			`loadSharePermissions failed (HTTP ${status}) · ${JSON.stringify(detail)}`,
		);
	}
}

export const shareLoaders = {
	loadSharePermissions,
};
