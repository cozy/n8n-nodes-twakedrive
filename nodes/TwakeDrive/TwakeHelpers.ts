import { IExecuteFunctions } from 'n8n-workflow';

export async function getRealToken(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	token: string,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const firstToken = token;

	const permissionsUrl = `${instanceUrl}/permissions`;
	const tokenResponse = await this.helpers.httpRequest({
		method: 'POST',
		url: permissionsUrl,
		headers: {
			Authorization: `Bearer ${firstToken}`,
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
		},
		body: {
			data: {
				type: 'io.cozy.permissions',
				attributes: {
					permissions: {
						'io.cozy.files': {
							description: 'Access your files',
							type: 'io.cozy.files',
							verbs: ['GET', 'POST'],
						},
					},
				},
			},
		},
		qs: {
			codes: 'n8n',
		},
		json: true,
	});
	ezlog('permissionsUrl', permissionsUrl);
	const realToken = tokenResponse.data.attributes.codes.n8n;
	ezlog('realToken', realToken);

	return { realToken };
}

export async function getOneFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	realToken: string,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
	const fileUrl = `${instanceUrl}/files/${fileId}`;
	const fileResponse = await this.helpers.httpRequest({
		method: 'GET',
		url: fileUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/vnd.api+json',
		},
		json: true,
	});
	ezlog('fileResponse', fileResponse);
	return { fileResponse };
}

export async function listFiles(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	realToken: string,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const fileListUrl = `${instanceUrl}/data/io.cozy.files/_all_docs?include_docs=true&Fields=name,metadata,type,id,cozyMetadata`;
	// const fileListUrl = `${instanceUrl}/data/io.cozy.files/_all_docs?include_docs=true`;
	const filesListResponse = await this.helpers.httpRequest({
		method: 'GET',
		url: fileListUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/json',
		},
		json: true,
	});
	ezlog('fileListResponse', filesListResponse);
	const docsArray = filesListResponse.rows;
	const wantedFilesArray = [];
	for (let i = 0; i < docsArray.length; i++) {
		// Skipping directories
		if (docsArray[i].doc.type === 'directory') continue;
		const filename = docsArray[i].doc.name;
		const id = docsArray[i].id;
		const uploadedBy = docsArray[i].doc.cozyMetadata?.uploadedBy.slug;
		const metadata = docsArray[i].doc.metadata;
		const oneFile = {
			filename,
			id,
			uploadedBy,
			metadata,
		};
		wantedFilesArray.push(oneFile);
	}
	// ezlog('filesList', wantedFilesArray);
	return { wantedFilesArray };
}

export async function uploadFile(
	this: IExecuteFunctions,
	itemIndex: number,
	ezlog: (name: string, value: any) => void,
	realToken: string,
) {
	const instanceUrl = this.getNodeParameter('instanceUrl', itemIndex, '') as string;
	const fileListUrl = `${instanceUrl}/data/io.cozy.files/_all_docs?include_docs=true&Fields=name,metadata,type,id,cozyMetadata`;
	// const fileListUrl = `${instanceUrl}/data/io.cozy.files/_all_docs?include_docs=true`;
	const filesListResponse = await this.helpers.httpRequest({
		method: 'GET',
		url: fileListUrl,
		headers: {
			Authorization: `Bearer ${realToken}`,
			Accept: 'application/json',
		},
		json: true,
	});
	ezlog('fileListResponse', filesListResponse);
	const docsArray = filesListResponse.rows;
	const wantedFilesArray = [];
	for (let i = 0; i < docsArray.length; i++) {
		// Skipping directories
		if (docsArray[i].doc.type === 'directory') continue;
		const filename = docsArray[i].doc.name;
		const id = docsArray[i].id;
		const uploadedBy = docsArray[i].doc.cozyMetadata?.uploadedBy.slug;
		const metadata = docsArray[i].doc.metadata;
		const oneFile = {
			filename,
			id,
			uploadedBy,
			metadata,
		};
		wantedFilesArray.push(oneFile);
	}
	// ezlog('filesList', wantedFilesArray);
	return { wantedFilesArray };
}
