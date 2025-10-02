import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class TwakeDriveOAuth2Api implements ICredentialType {
	displayName = 'Twake Drive OAuth2 API';
	documentationUrl =
		'https://github.com/cozy/cozy-stack/blob/master/docs/auth.md#what-about-oauth2';

	name = 'twakeDriveOAuth2Api';
	extends = ['oAuth2Api'];

	icon: Icon = {
		light: 'file:../nodes/TwakeDrive/icon.svg',
		dark: 'file:../nodes/TwakeDrive/icon.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Instance URL',
			name: 'instanceUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://yourinstance.mycozy.cloud or https://yourinstance.twake.linagora.com',
			hint: 'Base instance URL (without trailing slash). Ex: https://myinstance.mycozy.cloud or https://myinstance.twake.linagora.com',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://myinstance.mycozy.cloud/auth/authorize',
			hint: 'Format: instance-url + "/auth/authorize". Example → https://myinstance.mycozy.cloud/auth/authorize',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://myinstance.mycozy.cloud/auth/access_token',
			hint: 'Format: instance-url + "/auth/access_token". Example → https://myinstance.mycozy.cloud/auth/access_token',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{ displayName: 'Grant Type', name: 'grantType', type: 'hidden', default: 'authorizationCode' },
		{ displayName: 'Scopes', name: 'scope', type: 'hidden', default: 'io.cozy.files' },
		{ displayName: 'Authentication', name: 'authentication', type: 'hidden', default: 'body' },
	];

	oauth2 = {
		grantType: 'authorizationCode',
		scope: 'io.cozy.files',
		tokenRequestMethod: 'POST',
		authorizeUrl: { url: '={{ $credentials.authUrl }}' },
		accessTokenUrl: { url: '={{ $credentials.accessTokenUrl }}' },
		clientAuthentication: 'body',
	} as const;
}
