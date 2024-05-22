export interface IInvokeConfig {
  params: { apiVersion: string; endpoint?: string; };
  functions: {
    testResults: { name: string; };
    techRecords: { name: string; mock: string; };
    techRecordsSearch: { name: string; mock: string; };
    certGen: { name: string; };
    trailerRegistration: { name: string; };
    testStations: { name: string; mock: string; };
    defects: { name: string; };
  };
}
