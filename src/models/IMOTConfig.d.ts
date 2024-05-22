export interface IMOTConfig {
  endpoint: string;
  documentDir: 'CVS';
  documentNames: {
    vt20: 'VT20.pdf';
    vt20w: 'VT20W.pdf';
    vt30: 'VT30.pdf';
    vt30w: 'VT30W.pdf';
    vt32ve: 'VT32VE.pdf';
    vt32vew: 'VT32VEW.pdf';
    prs: 'PRS.pdf';
    prsw: 'PRSW.pdf';
    ct20: 'CT20.pdf';
    ct30: 'CT30.pdf';
    vtp20: 'VTP20.pdf';
    vtp20_bilingual: 'VTP20_BILINGUAL.pdf';
    vtp30: 'VTP30.pdf';
    vtp30_bilingual: 'VTP30_BILINGUAL.pdf';
    psv_prs: 'PSV_PRS.pdf';
    psv_prs_bilingual: 'PSV_PRS_BILINGUAL.pdf';
    vtg5: 'VTG5.pdf';
    vtg5_bilingual: 'VTG5_BILINGUAL.pdf';
    vtg5a: 'VTG5A.pdf';
    vtg5a_bilingual: 'VTG5A_BILINGUAL.pdf';
    vtg30: 'VTG30.pdf';
    vtg30_bilingual: 'VTG30_BILINGUAL.pdf';
    hgv_prs: 'HGV_PRS.pdf';
    hgv_prs_bilingual: 'HGV_PRS_BILINGUAL.pdf';
    trl_prs: 'TRL_PRS.pdf';
    trl_prs_bilingual: 'TRL_PRS_BILINGUAL.pdf';
    adr_pass: 'ADR_PASS.pdf';
    rwt: 'RWT.pdf;';
    iva_fail: 'IVA30.pdf';
    msva_fail: 'MSVA30.pdf';
  };
  api_key: string;
}
