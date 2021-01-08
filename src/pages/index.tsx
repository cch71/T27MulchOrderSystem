import React, { useState, useEffect } from "react"
import { Router, Link } from '@reach/router'
import AddNewOrderWidget from "../components/add_new_order_widget"
import auth from "../js/auth"
import { navigate } from "gatsby"
import {orderDb, LeaderBoardSummaryInfo} from "../js/ordersdb"
import {FundraiserConfig, downloadFundraiserConfig, getFundraiserConfig} from "../js/fundraiser_config"
import awsConfig from "../config"
import currency from "currency.js"

const USD = (value: currency) => currency(value, { symbol: "$", precision: 2 });

async function enableReady(frConfig: FundraiserConfig, setOrderSummary) {
    const summaryArr=[];
    orderDb.getOrderSummary().then((summary: LeaderBoardSummaryInfo)=>{
        if (!summary) { return; }

        const topSellers = [];
        for (const [ranking, seller, amt] of summary.topSellers()) {
            topSellers.push(
                <tr key={ranking}>
                    <td className="py-1">{ranking}</td>
                    <td className="py-1">{frConfig.getUserNameFromId(seller)}</td>
                    <td className="py-1">{USD(amt).format()}</td>
                </tr>
            );
        }
        //console.log("TopSeller ${JSON.stringify(topSellers)}")
        let statIndex=0;
        const summaryStats = [];
        const userSummary = summary.userSummary();
        summaryStats.push(
            <li key={++statIndex} className="list-group-item border-0 py-1">
                You have collected {USD(userSummary.amountSold).format()} in sales
            </li>
        );
        if ('mulch' === frConfig.kind()) {
            summaryStats.push(
                <li key={++statIndex} className="list-group-item border-0 py-1">
                    You have sold {userSummary.bags} bags of mulch
                </li>
            );
            summaryStats.push(
                <li key={++statIndex} className="list-group-item border-0 py-1">
                    You have sold {userSummary.spreading} spreading jobs
                </li>
            );
        }

        if (0.0 < userSummary.donation.value) {
            summaryStats.push(
                <li key={++statIndex} className="list-group-item border-0 py-1">
                    You have collected {USD(userSummary.donation).format()} in donations
                </li>
            );
        }

        summaryStats.push(
            <li key={++statIndex} className="list-group-item border-0 py-1">
                Troop has sold {USD(summary.troopAmountSold()).format()}
            </li>
        );

        //console.log("Summary ${JSON.stringify(summaryStats)}")

        setOrderSummary(
            <div>
                <div className="justify-content-center text-center">
                    <h6>{frConfig.description()} Fundraiser</h6>
                    <div className="col-xs-1 d-flex justify-content-center">
                        <div className="row">

                            <div className="col-lg-4">
                                <div className="card" id="orderOwnerSummaryCard">
                                    <div className="card-header">
                                        Summary for: {frConfig.getUserNameFromId(auth.getCurrentUserId())}
                                    </div>
                                    <div className="card-body text-start">
                                        <small muted>*updates may take up to 15 minutes</small>
                                        <ul className="list-group list-group-flush sm-owner-summary"
                                            id="orderOwnerSummaryList">
                                            {summaryStats}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-4">
                                <div className="card" id="topSellersCard">
                                    <div className="card-header">Top Sellers:</div>
                                    <div className="card-body text-start">
                                        <table className="table table-sm table-borderless table-responsive"
                                               id="topSellersTable">
                                            <tbody>
                                                {topSellers}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-4">
                                <div className="card" id="patrolStandingsChartCard">
                                    <div className="card-header">Sales by Patrol:</div>
                                    <div className="card-body">
                                        <div id="patrolStandingsChart"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <AddNewOrderWidget/>
            </div>
        );


        // Draw Charts
        const drawCharts=()=>{

            const options = {
                is3D: true,
                legend: 'left'
            };

            const patrolStandingsData = new google.visualization.DataTable();
            patrolStandingsData.addColumn('string', 'Patrol Sales');
            patrolStandingsData.addColumn('number', 'Amount Sold');

            for (const [patrol, amount] of summary.patrolRankings()) {
                patrolStandingsData.addRow([patrol, amount.value]);
            }

            const patrolStandingsChart = new google.visualization.PieChart(
                document.getElementById('patrolStandingsChart'));
            patrolStandingsChart.draw(patrolStandingsData, options);


        };
        // Load the Visualization API and the corechart package.
        google.charts.load('current', {'packages':['corechart']});
        // Set a callback to run when the Google Visualization API is loaded.
        google.charts.setOnLoadCallback(drawCharts);
    });
}

const Home = ()=>{

    const [orderSummary, setOrderSummary] = useState();
    const [isLoading, setIsLoading] = useState(false);

    const switchToSignOn = ()=>{
        setIsLoading(false);
        navigate('/signon/');
    };


    useEffect(() => {
        setIsLoading(true);
        const onAsyncView = async ()=>{
            const [isValidSession, session] = await auth.getSession();
            if (!isValidSession) {
                // If no active user go to login screen
                switchToSignOn();
                return;
            }
            console.log(`Active User: ${auth.getCurrentUserId()}`);

            const authToken = await auth.getAuthToken();

            try {
                const frConfig = getFundraiserConfig();
                await enableReady(frConfig, setOrderSummary);
            } catch(err: any) {
                const loadedConfig = await downloadFundraiserConfig(authToken);
                if (!loadedConfig) {
                    throw(new Err("Failed to load session fundraising config"));
                }
                await enableReady(loadedConfig, setOrderSummary);
            }
            setIsLoading(false);
        };

        onAsyncView()
            .then()
            .catch((err)=>{
                if ('Invalid Session'===err.message) {
                    switchToSignOn();
                    return;
                } else {
                    console.error(err);
                }
            });
    }, []);

    return (
        <div id="indexPage">
            {isLoading ? (
                <div id="notReadyView" className='col-xs-1 d-flex justify-content-center' >
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : (
                <>{orderSummary}</>
            )}
        </div>
    );
}

export default Home;
