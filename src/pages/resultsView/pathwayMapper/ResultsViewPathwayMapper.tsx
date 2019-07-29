import * as React from "react";
import * as _ from "lodash";
import $ from "jquery";
import { QueryParameter } from "../../../shared/lib/ExtendedRouterStore";
import {ResultsViewPageStore, SamplesSpecificationElement, IQueriedMergedTrackCaseData, IQueriedCaseData} from "../ResultsViewPageStore";
import { ResultsViewTab } from "../ResultsViewPageHelpers";
import { generateGeneAlterationData } from "../download/DownloadUtils";
import PathwayMapper, {ICBioData} from "react-pathway-mapper";
import "react-pathway-mapper/dist/base.css";
import PathwayMapperTable, { IPathwayMapperTable } from "./PathwayMapperTable";
import { observer } from "mobx-react";
import autobind from "autobind-decorator";
import { observable, ObservableMap, computed } from "mobx";
import { alterationInfoForOncoprintTrackData } from "shared/components/oncoprint/OncoprintUtils";
import { isMergedTrackFilter } from "shared/lib/oql/oqlfilter";
import { Sample, Patient, MolecularProfile, Gene } from "shared/api/generated/CBioPortalAPI";
import { makeGeneticTrackData } from "shared/components/oncoprint/DataUtils";
import { CoverageInformation } from "../ResultsViewPageStoreUtils";
import { Grid, Col, Row } from "react-bootstrap";

import ReactTooltip from "react-tooltip";
import { AppStore } from "AppStore";
import { remoteData } from "cbioportal-frontend-commons";
import LoadingIndicator from "shared/components/loadingIndicator/LoadingIndicator";
import { fetchGenes } from "shared/lib/StoreUtils";
import { ErrorMessages } from "shared/enums/ErrorEnums";

interface IResultsViewPathwayMapperProps{
    store: ResultsViewPageStore;
    initStore: Function;
    appStore: AppStore;
}

@observer
export default class ResultsViewPathwayMapper extends React.Component<IResultsViewPathwayMapperProps, {}>{
    

    @observable
    tableData: IPathwayMapperTable[];

    cBioData: ICBioData[];

    @observable storeForAllData: ResultsViewPageStore;

    @observable selectedPathway: string = "";

    pathwayHandler: Function;

    @observable
    isLoading: boolean;

    @observable
    currentGenes: string[];

    @observable
    remoteGenes = remoteData<string[]>({
        invoke: async () => {
            console.log("here1.5");

            const genes = await fetchGenes(this.currentGenes);

            console.log("here2");
            console.log(genes.map(gene => (gene.hugoGeneSymbol)));
            // Check that the same genes are in the OQL query as in the API response (order doesnt matter).
            return genes.map(gene => (gene.hugoGeneSymbol));
        },
        onResult:(genes:string[])=>{
            //this.geneCache.addData(genes);
            this.geneChangeHandler(genes);
        }
    });
    addGenomicData: (alterationData: ICBioData[]) => void;


    constructor(props: IResultsViewPathwayMapperProps){
        super(props);
        this.cBioData = [];
        this.tableData = [];
        this.isLoading = false;
    }

    render(){
        this.props.store.oqlFilteredCaseAggregatedDataByUnflattenedOQLLine.result!.forEach( (alterationData, trackIndex) => {

            this.getOncoData(this.props.store.samples.result,
                             this.props.store.patients.result,
                             this.props.store.coverageInformation.result,
                             this.props.store.sequencedSampleKeysByGene.result!,
                             this.props.store.sequencedPatientKeysByGene.result!,
                             this.props.store.selectedMolecularProfiles.result!,
                             alterationData);
        });


        const isNewStoreReady = this.storeForAllData && this.storeForAllData.oqlFilteredCaseAggregatedDataByUnflattenedOQLLine.isComplete &&
        this.storeForAllData.samples.isComplete &&
        this.storeForAllData.patients.isComplete &&
        this.storeForAllData.coverageInformation.isComplete &&
        this.storeForAllData.sequencedSampleKeysByGene.isComplete &&
        this.storeForAllData.sequencedPatientKeysByGene.isComplete &&
        this.storeForAllData.selectedMolecularProfiles.isComplete;

        if(isNewStoreReady){

            this.storeForAllData.oqlFilteredCaseAggregatedDataByUnflattenedOQLLine.result!.forEach( (alterationData, trackIndex) => {
                this.getOncoData(this.storeForAllData.samples.result,
                                 this.storeForAllData.patients.result,
                                 this.storeForAllData.coverageInformation.result,
                                 this.storeForAllData.sequencedSampleKeysByGene.result!,
                                 this.storeForAllData.sequencedPatientKeysByGene.result!,
                                 this.storeForAllData.selectedMolecularProfiles.result!,
                                 alterationData);
                
            });

            this.addGenomicData(this.cBioData);
        }

        console.log("this.remoteGenes");
        console.log(this.remoteGenes.result);
        return(

            <div style={{width: "99%"}}>
                <Row>
                
                    { !this.isLoading ? 
                    (<PathwayMapper isCBioPortal={true} isCollaborative={false} 
                                genes={this.props.store.genes.result as any}
                                cBioAlterationData={this.cBioData}
                                queryParameter={QueryParameter.GENE_LIST}
                                oncoPrintTab={ResultsViewTab.ONCOPRINT}
                                changePathwayHandler={this.changePathwayHandler}
                                addGenomicDataHandler={this.addGenomicDataHandler}
                                tableComponent={PathwayMapperTable}/>)
                    : (<LoadingIndicator isLoading={true} size={"big"} center={true}>
                                </LoadingIndicator>)
                    }
                </Row>
            </div>);
    }


    setIsLoading(isLoading: boolean){
        this.isLoading = isLoading;
    }

    @autobind
    addGenomicDataHandler(addGenomicData: (alterationData: ICBioData[]) => void){
        this.addGenomicData = addGenomicData;
        console.log("here ADDGENO HANDLER");
    }

    geneChangeHandler(genes: string[]){
        this.storeForAllData = this.props.initStore(this.props.appStore, genes.join(" "));
    }

    @autobind
    changePathwayHandler(pathwayGenes: string[]){
        this.currentGenes = pathwayGenes;
        
        //this.setIsLoading(true);
    }
    
    getOncoData(
        samples: Pick<Sample, 'sampleId'|'studyId'|'uniqueSampleKey'>[],
        patients: Pick<Patient, 'patientId'|'studyId'|'uniquePatientKey'>[],
        coverageInformation: CoverageInformation,
        sequencedSampleKeysByGene: any,
        sequencedPatientKeysByGene: any,
        selectedMolecularProfiles: MolecularProfile[],
        caseData:IQueriedMergedTrackCaseData | (IQueriedCaseData<any> & { mergedTrackOqlList?:never })){
        
        const sampleMode = false;
        const oql = caseData.oql;
        const geneSymbolArray = (isMergedTrackFilter(oql)
            ? oql.list.map(({gene}) => gene)
            : [oql.gene]
        );
        const dataByCase = caseData.cases;
        const data = makeGeneticTrackData(dataByCase.patients, geneSymbolArray, patients as Patient[], coverageInformation, selectedMolecularProfiles);

        const alterationInfo = alterationInfoForOncoprintTrackData(
            sampleMode,
            {trackData: data, oql: geneSymbolArray},
            sequencedSampleKeysByGene,
            sequencedPatientKeysByGene
        );

        // console.log(alterationInfo);
        // console.log(oql);
        this.cBioData.push({gene: (oql as any).gene, altered: alterationInfo.altered, sequenced: alterationInfo.sequenced, percentAltered: alterationInfo.percent});
    }
}