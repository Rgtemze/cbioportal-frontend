
import * as React from 'react';
import * as _ from "lodash";
import { observer } from "mobx-react";
import LazyMobXTable, { Column } from "shared/components/lazyMobXTable/LazyMobXTable";
import { observable } from 'mobx';
import { Radio } from 'react-bootstrap';
import DefaultTooltip from 'public-lib/components/defaultTooltip/DefaultTooltip';

export interface IPathwayMapperTable {
    name: string;
    score: number;
    genes: string[];
}

enum IPathwayMapperTableColumnType {
    NAME,
    SCORE,
    GENES
}

interface IPathwayMapperTableProps {
    data: IPathwayMapperTable[];
    selectedPathway: string;
    changePathway: Function;
    initialSortColumn?: string;
}

type PathwayMapperTableColumn = Column<IPathwayMapperTable>;

class PathwayMapperTableComponent extends LazyMobXTable<IPathwayMapperTable> {
}

@observer
export default class PathwayMapperTable extends React.Component<IPathwayMapperTableProps> {
    public static defaultProps = {
        columns: [
            IPathwayMapperTableColumnType.NAME,
            IPathwayMapperTableColumnType.SCORE,
            IPathwayMapperTableColumnType.GENES,
        ],
        initialSortColumn: "name"
    };
    @observable protected _columns: { [columnEnum: number]: PathwayMapperTableColumn };
    @observable selectedPathway: string ;

    constructor(props: IPathwayMapperTableProps) {
        super(props);
        this._columns = {};
        this.selectedPathway = this.props.data[0].name;
        this.generateColumns();
    }

    componentDidMount(){
        this.selectedPathway = this.props.data[0].name;
    }

    generateColumns() {
        const lengthThreshold = 20;

        this._columns = {};

        this._columns[IPathwayMapperTableColumnType.NAME] = {
            name: "Pathway name",
            render: (d: IPathwayMapperTable) => {
                const pwName = d.name;
                const isPwNameShort = pwName.length < lengthThreshold;
                return (
                        <Radio 
                            style={{marginTop: 0, marginBottom: 0}}
                            checked={this.selectedPathway === d.name} 
                            onChange={(e: any) => {this.props.changePathway(d.name); this.selectedPathway = d.name;}}>
                            <DefaultTooltip overlay={pwName} disabled={isPwNameShort}>
                                <b>{(isPwNameShort ? pwName : pwName.substring(0, lengthThreshold) + "...")}</b>
                            </DefaultTooltip>
                        </Radio>
                );
            },
            tooltip: <span>Pathway name</span>,
            filter: (d: IPathwayMapperTable, filterString: string, filterStringUpper: string) =>
                d.name.toUpperCase().includes(filterStringUpper),
            sortBy: (d: IPathwayMapperTable) => d.name,
            download: (d: IPathwayMapperTable) => d.name
        };

        this._columns[IPathwayMapperTableColumnType.SCORE] = {
            name: "Score",
            render: (d: IPathwayMapperTable) => <span><b>{d.score.toFixed(2)}</b></span>,
            tooltip: <span>Score</span>,
            filter: (d: IPathwayMapperTable, filterString: string, filterStringUpper: string) =>
                (d.score + "").includes(filterStringUpper),
            sortBy: (d: IPathwayMapperTable) => d.score,
            download: (d: IPathwayMapperTable) => d.score + ""
        };

        this._columns[IPathwayMapperTableColumnType.GENES] = {
            name: "Genes matched",
            render: (d: IPathwayMapperTable) => {
                const geneTextLength = d.genes.join(" ").length;

                return (
                    <DefaultTooltip overlay={d.genes.join(" ")} disabled={geneTextLength < lengthThreshold}>
                        <span>
                            {this.calculateGeneStr(d.genes, lengthThreshold)}
                        </span>
                    </DefaultTooltip>
                );
            },
            tooltip: <span>Genes matched</span>,
            sortBy: (d: IPathwayMapperTable) => d.genes,
            download: (d: IPathwayMapperTable) => d.genes.toString()
        };
    }

    render() {
        const columns = _.sortBy(this._columns);
        return (
            <PathwayMapperTableComponent 
                columns={columns}
                data={this.props.data}
                initialItemsPerPage={10}
                initialSortColumn={this.props.initialSortColumn}
                paginationProps={{ itemsPerPageOptions: [10] }}
                showColumnVisibility={false}
            />
        );
    }

    // It calculates truncated version of gene string without truncating gene names.
    // That is, instead of truncating a gene name, it removes it all.
    // For example, if the gene string is MDM2 CDKN2A, instead of truncating it as "MDM2 CKDN ...",
    // it produces "MDM2 ..."
    private calculateGeneStr(genesMatched: string[], lengthThreshold: number){
        let runningLength = 0;
        let geneStr = "";
        for(const geneName of genesMatched){
            runningLength += geneName.length;
            if(runningLength < lengthThreshold){
                geneStr += geneName + " ";
                runningLength++; //Whitespace is added
            } else{
                return geneStr + "...";
            }
        }
        return geneStr;
    }
}