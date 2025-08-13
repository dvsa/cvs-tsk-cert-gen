import { Service } from 'typedi';
import { IMOTConfig } from '../models';
import { Configuration } from '../utils/Configuration';

@Service()
export class CertificateTypes {
	private readonly config: Configuration = Configuration.getInstance();

	public getCertificateType(type: string): string {
		const config: IMOTConfig = this.config.getMOTConfig();

		const certTypes = {
			psv_pass: config.documentNames.vtp20,
			psv_pass_bilingual: config.documentNames.vtp20_bilingual,
			psv_fail: config.documentNames.vtp30,
			psv_fail_bilingual: config.documentNames.vtp30_bilingual,
			psv_prs: config.documentNames.psv_prs,
			psv_prs_bilingual: config.documentNames.psv_prs_bilingual,
			hgv_pass: config.documentNames.vtg5,
			hgv_pass_bilingual: config.documentNames.vtg5_bilingual,
			hgv_fail: config.documentNames.vtg30,
			hgv_fail_bilingual: config.documentNames.vtg30_bilingual,
			hgv_prs: config.documentNames.hgv_prs,
			hgv_prs_bilingual: config.documentNames.hgv_prs_bilingual,
			trl_pass: config.documentNames.vtg5a,
			trl_pass_bilingual: config.documentNames.vtg5a_bilingual,
			trl_fail: config.documentNames.vtg30,
			trl_fail_bilingual: config.documentNames.vtg30_bilingual,
			trl_prs: config.documentNames.trl_prs,
			trl_prs_bilingual: config.documentNames.trl_prs_bilingual,
			rwt: config.documentNames.rwt,
			adr_pass: config.documentNames.adr_pass,
			iva_fail: config.documentNames.iva_fail,
			msva_fail: config.documentNames.msva_fail,
			hgv_abandoned: config.documentNames.hgv_abandoned,
			trl_abandoned: config.documentNames.trl_abandoned,
			psv_abandoned: config.documentNames.psv_abandoned,
		};

		const keyTyped = type as keyof typeof certTypes;
		return certTypes[keyTyped];
	}
}
