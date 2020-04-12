import * as React from 'react';
import _ from 'lodash';
import { ResultsViewPageStore } from '../ResultsViewPageStore';
import { addGenesToQuery, ResultsViewTab } from '../ResultsViewPageHelpers';
import PathwayMapper, { ICBioData } from 'pathway-mapper';
import 'pathway-mapper/dist/base.css';
import PathwayMapperTable, { IPathwayMapperTable } from './PathwayMapperTable';
import { observer } from 'mobx-react';
import autobind from 'autobind-decorator';
import {
    observable,
    computed,
    action,
    reaction,
    IReactionDisposer,
} from 'mobx';
import { Row } from 'react-bootstrap';

import { AppStore } from 'AppStore';
import { remoteData } from 'cbioportal-frontend-commons';
import { fetchGenes } from 'shared/lib/StoreUtils';
import OqlStatusBanner from 'shared/components/banners/OqlStatusBanner';
import { getAlterationData } from 'shared/components/oncoprint/OncoprintUtils';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer, toast } from 'react-toastify';
import { initStore } from '../ResultsViewPage';
import ResultsViewURLWrapper from '../ResultsViewURLWrapper';

import 'cytoscape-panzoom/cytoscape.js-panzoom.css';
import 'cytoscape-navigator/cytoscape.js-navigator.css';
import 'react-toastify/dist/ReactToastify.css';
import styles from './pathwayMapper.module.scss';

interface IResultsViewPathwayMapperProps {
    store: ResultsViewPageStore;
    appStore: AppStore;
    urlWrapper: ResultsViewURLWrapper;
}

@observer
export default class ResultsViewPathwayMapper extends React.Component<
    IResultsViewPathwayMapperProps
> {
    private accumulatedAlterationFrequencyDataForNonQueryGenes: ICBioData[];
    private readonly accumulatedValidGenes: { [gene: string]: boolean };

    @observable
    private selectedPathway = '';

    @observable
    private newGenesFromPathway: string[];

    @observable
    private activeToasts: React.ReactText[];

    @observable
    private message: string;

    private readonly DEFAULT_MESSAGE = 'Welcome to Pathways tab...';
    private readonly LOADING_MESSAGE = 'Loading alteration data...';
    @observable
    private isMessageShown = false;
    private toastReaction: IReactionDisposer;

    private readonly validNonQueryGenes = remoteData<string[]>({
        invoke: async () => {
            const genes = await fetchGenes(this.newGenesFromPathway);

            return genes.map(gene => gene.hugoGeneSymbol);
        },
        onResult: (genes: string[]) => {
            // show loading text only if there are actually new genes to load
            if (genes.length > 0) {
                this.showMessage(this.LOADING_MESSAGE);
            }
        },
    });

    @observable
    private addGenomicData: (alterationData: ICBioData[]) => void;

    constructor(props: IResultsViewPathwayMapperProps) {
        super(props);
        this.activeToasts = [];
        this.accumulatedValidGenes = {};
        this.accumulatedAlterationFrequencyDataForNonQueryGenes = [];

        this.toastReaction = reaction(
            () => [props.store.tabId],
            ([tabId]) => {
                // Close all toasts when the Pathway Mapper tab is not visible.
                if (tabId !== ResultsViewTab.PATHWAY_MAPPER) {
                    this.activeToasts.length = 0;
                    toast.dismiss();
                }
            },
            { fireImmediately: true }
        );
    }

    @computed get alterationFrequencyData(): ICBioData[] {
        return this.alterationFrequencyDataForQueryGenes.concat(
            this.alterationFrequencyDataForNonQueryGenes
        );
    }

    @computed get alterationFrequencyDataForQueryGenes() {
        const alterationFrequencyData: ICBioData[] = [];

        this.props.store.oqlFilteredCaseAggregatedDataByUnflattenedOQLLine.result!.forEach(
            alterationData => {
                const data = getAlterationData(
                    this.props.store.samples.result,
                    this.props.store.patients.result,
                    this.props.store.coverageInformation.result,
                    this.props.store.sequencedSampleKeysByGene.result!,
                    this.props.store.sequencedPatientKeysByGene.result!,
                    this.props.store.selectedMolecularProfiles.result!,
                    alterationData,
                    true,
                    this.props.store.genes.result!
                );

                if (data) {
                    alterationFrequencyData.push(data);
                }
            }
        );

        return alterationFrequencyData;
    }

    @computed get alterationFrequencyDataForNonQueryGenes() {
        const alterationFrequencyDataForNewGenes: ICBioData[] = [];

        if (this.isNewStoreReady) {
            this.storeForAllData!.oqlFilteredCaseAggregatedDataByUnflattenedOQLLine.result!.forEach(
                alterationData => {
                    const data = getAlterationData(
                        this.storeForAllData!.samples.result,
                        this.storeForAllData!.patients.result,
                        this.storeForAllData!.coverageInformation.result,
                        this.storeForAllData!.sequencedSampleKeysByGene.result!,
                        this.storeForAllData!.sequencedPatientKeysByGene
                            .result!,
                        this.storeForAllData!.selectedMolecularProfiles.result!,
                        alterationData,
                        false,
                        this.props.store.genes.result!
                    );

                    if (data) {
                        alterationFrequencyDataForNewGenes.push(data);
                    }
                }
            );
        }

        // on pathway change PathwayMapper returns only the genes that are new (i.e genes for which we haven't
        // calculated the alteration data yet), so we need to accumulate the alteration frequency data after each
        // query
        this.accumulatedAlterationFrequencyDataForNonQueryGenes = this.accumulatedAlterationFrequencyDataForNonQueryGenes.concat(
            alterationFrequencyDataForNewGenes
        );

        return this.accumulatedAlterationFrequencyDataForNonQueryGenes;
    }

    @computed get isNewStoreReady() {
        return (
            this.storeForAllData &&
            this.storeForAllData
                .oqlFilteredCaseAggregatedDataByUnflattenedOQLLine.isComplete &&
            this.storeForAllData.samples.isComplete &&
            this.storeForAllData.patients.isComplete &&
            this.storeForAllData.coverageInformation.isComplete &&
            this.storeForAllData.sequencedSampleKeysByGene.isComplete &&
            this.storeForAllData.sequencedPatientKeysByGene.isComplete &&
            this.storeForAllData.selectedMolecularProfiles.isComplete
        );
    }

    public render() {
        // Alteration data of non-query genes are loaded.
        if (this.isNewStoreReady) {
            this.addGenomicData(this.alterationFrequencyData);
            if (this.message === this.LOADING_MESSAGE) {
                this.dismissMessage();
            }
        }

        return (
            <div className="pathwayMapper">
                <div
                    data-test="pathwayMapperTabDiv"
                    className="cBioMode"
                    style={{ width: '99%' }}
                >
                    <Row>
                        <React.Fragment>
                            <OqlStatusBanner
                                className="coexp-oql-status-banner"
                                store={this.props.store}
                                tabReflectsOql={true}
                            />

                            <PathwayMapperMessageBox
                                message={this.message}
                                DEFAULT_MESSAGE={this.DEFAULT_MESSAGE}
                                LOADING_MESSAGE={this.LOADING_MESSAGE}
                            />

                            <PathwayMapper
                                isCBioPortal={true}
                                isCollaborative={false}
                                genes={this.props.store.genes.result as any}
                                cBioAlterationData={
                                    this.alterationFrequencyData
                                }
                                onAddGenes={this.handleAddGenes}
                                changePathwayHandler={this.handlePathwayChange}
                                addGenomicDataHandler={
                                    this.addGenomicDataHandler
                                }
                                tableComponent={this.renderTable}
                                validGenes={this.validGenes}
                                toast={toast}
                                showMessage={this.showMessage}
                            />
                            <ToastContainer
                                closeButton={<i className="fa fa-times" />}
                            />
                        </React.Fragment>
                    </Row>
                </div>
            </div>
        );
    }

    componentWillUnmount(): void {
        this.toastReaction();
    }

    /**
     * We need to initialize a separate ResultsViewStore to be able to fetch alteration data for non-query genes.
     */
    @computed get storeForAllData(): ResultsViewPageStore | undefined {
        if (
            this.urlWrapperForAllGenes &&
            (!this.urlWrapperForAllGenes.hasSessionId ||
                !this.urlWrapperForAllGenes.remoteSessionData.isPending)
        ) {
            return initStore(this.props.appStore, this.urlWrapperForAllGenes);
        } else {
            return undefined;
        }
    }

    /**
     * Here we clone the "query" field of the main store's URL Wrapper and enhance the cloned query
     * with additional non-query genes. This new query object is used to fake a new URL Wrapper instance
     * which is required to initialize a separate ResultsViewStore for the non-query genes.
     */
    @computed get urlWrapperForAllGenes(): ResultsViewURLWrapper | undefined {
        let urlWrapper: ResultsViewURLWrapper | undefined;

        if (
            this.validNonQueryGenes.isComplete &&
            this.validNonQueryGenes.result.length > 0
        ) {
            // fake the URL wrapper, we only need the query parameters with additional genes
            const query: { [key: string]: string | undefined } = _.cloneDeep(
                this.props.urlWrapper.query
            );
            query.gene_list = this.validNonQueryGenes.result.join(' ');

            // we don't need a proper URL Wrapper here, just assign an object with a valid query field
            urlWrapper = { query } as ResultsViewURLWrapper;
        }

        return urlWrapper;
    }

    /**
     * Valid non-query genes accumulated from currently selected pathway
     * and previously selected pathways in a single query session.
     */
    @computed get validGenes() {
        if (this.validNonQueryGenes.isComplete) {
            // Valid genes are accumulated.
            this.validNonQueryGenes.result.forEach(gene => {
                this.accumulatedValidGenes[gene] = true;
            });
        }
        return this.accumulatedValidGenes;
    }

    /**
     * addGenomicData function is implemented in PathwayMapper component and overlays
     * alteration data onto genes. Through this function callback, the function implemented
     * in PathwayMapper is copied here.
     */
    @autobind
    @action
    private addGenomicDataHandler(
        addGenomicData: (alterationData: ICBioData[]) => void
    ) {
        this.addGenomicData = addGenomicData;
    }

    @autobind
    @action
    private handlePathwayChange(pathwayGenes: string[]) {
        // Pathway genes here are the genes that are in the pathway and valid whose alteration data is not calculated yet.
        // Pathway genes does NOT always include all of the non-query genes
        // Some of the pathway genes may be invalid/unknown gene symbols
        this.newGenesFromPathway = pathwayGenes;
    }

    @autobind
    @action
    private handleAddGenes(selectedGenes: string[]) {
        addGenesToQuery(this.props.urlWrapper, selectedGenes);
    }

    @autobind
    private dismissMessage() {
        // Toasts are removed with delay
        setTimeout(() => {
            this.message = null;
        }, 2000);
    }

    @autobind
    private showMessage(message: string) {
        this.message = message;
    }
    @autobind
    private renderTable(
        data: IPathwayMapperTable[],
        selectedPathway: string,
        onPathwaySelect: (pathway: string) => void
    ) {
        return (
            <PathwayMapperTable
                data={data}
                selectedPathway={selectedPathway}
                changePathway={onPathwaySelect}
            />
        );
    }
}
interface PathwayMapperMessageBoxProps {
    message: string;
    DEFAULT_MESSAGE: string;
    LOADING_MESSAGE: string;
}
const PathwayMapperMessageBox: React.SFC<
    PathwayMapperMessageBoxProps
> = props => {
    const [message, setMessage] = React.useState(props.message);
    React.useEffect(() => {
        setMessage(props.message);
    }, [props]);
    const isWarningMessage =
        message &&
        message !== props.LOADING_MESSAGE &&
        message !== props.DEFAULT_MESSAGE;
    return (
        <div
            className={
                'alert ' +
                (isWarningMessage ? 'alert-warning' : 'alert-success')
            }
            style={{
                marginLeft: '1%',
                marginBottom: '0px',
                color: message ? 'black' : 'gray',
                maxHeight: '35px',
                overflowY: 'auto',
            }}
        >
            <button
                type="button"
                className="close"
                onClick={() => {
                    setMessage(null);
                }}
                style={{
                    display: message ? 'block' : 'none',
                }}
            >
                &times;
            </button>
            {isWarningMessage && (
                <i
                    className="fa fa-md fa-exclamation-triangle"
                    style={{
                        marginRight: '6px',
                        marginBottom: '1px',
                    }}
                ></i>
            )}
            {message || props.DEFAULT_MESSAGE}
        </div>
    );
};
