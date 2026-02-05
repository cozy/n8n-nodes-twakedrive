import type { IAllExecuteFunctions, IRequestOptions } from 'n8n-workflow';

const CREDENTIAL_TYPE = 'twakeDriveOAuth2Api';

// See https://github.com/n8n-io/n8n/blob/cfd59cc55b998fe7921a2d11ba495e0410ad4aeb/packages/workflow/src/interfaces.ts#L80
const OAUTH2_OPTS = {
	oauth2: {
		tokenExpiredStatusCode: 400,
		includeCredentialsOnRefreshOnBody: true,
	},
};

/**
 * Thin wrapper around `requestWithAuthentication` that always injects the
 * Twake Drive OAuth2 credential type and the options required for automatic
 * token refresh (Cozy Stack returns HTTP 400 for expired tokens and expects
 * client credentials in the refresh POST body).
 */
export async function twakeDriveRequest(
	this: IAllExecuteFunctions,
	requestOptions: IRequestOptions,
): Promise<any> {
	return this.helpers.requestWithAuthentication.call(
		this,
		CREDENTIAL_TYPE,
		requestOptions,
		OAUTH2_OPTS,
	);
}
