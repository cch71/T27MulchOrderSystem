import React, { useState, useEffect } from "react";
import NavBar from "../components/navbar";
import { navigate } from "gatsby";
import {orderDb, OrderListItem} from "../js/ordersdb";
import currency from "currency.js";
import auth from "../js/auth"
import jQuery from 'jquery';
import {FundraiserConfig, getFundraiserConfig} from "../js/fundraiser_config";
import bootstrapIconSprite from "bootstrap-icons/bootstrap-icons.svg";
import * as bs from 'bootstrap/dist/js/bootstrap.min.js'
const addOrderImg = bootstrapIconSprite + "#plus-square-fill";
const trashImg = bootstrapIconSprite + "#trash";
const pencilImg = bootstrapIconSprite + "#pencil";
const eyeImg = bootstrapIconSprite + "#eye";
const exportImg = bootstrapIconSprite + "#cloud-download";
const reportSettingsImg = bootstrapIconSprite + "#gear";
const spreadImg = bootstrapIconSprite + "#layout-wtf";

const USD = (value: currency) => currency(value, { symbol: "$", precision: 2 });
const rprtStngDlgRt = 'reportViewSettingsDlg';
const spreadingDlgRt = 'spreadingDlg';
let reportSettingsDlg = undefined;


////////////////////////////////////////////////////////////////////
//
class ReportViews {
    private currentView_: string = "";
    private currentUserId_: string = "";
    private currentDataTable_: any = undefined;
    private currentQueryResults_: Array<OrderListItem<string>> = undefined;

    constructor() {
        console.log("Constructing...");
    }

    ////////////////////////////////////////////////////////////////////
    //
    showView(view: string, frConfig: FundraiserConfig, userId?: string) {
        const asyncShow = async () => {
            
            if (jQuery.fn.dataTable.isDataTable( '#orderListTable')) {
                if (view === this.currentView_ && userId === this.currentUserId_) { return; }

                jQuery('#orderListTable').DataTable().clear();
                jQuery('#orderListTable').DataTable().destroy();
                jQuery('#orderListTable').empty();
                delete this.currentDataTable_;
                delete this.currentQueryResults_;
            }

            console.log(`Current View: ${this.currentView_} New View: ${view}`);
            console.log(`Current User: ${this.currentUserId_} New User: ${userId}`);
            this.currentView_ = view;
            this.currentUserId_ = userId;

            if(typeof this[`show${view}`] === 'function') {
                this[`show${view}`](frConfig, userId);
            } else {
                throw new Error(`Report View Type: ${view} not found`);
            }

            const spinnerElm = document.getElementById('orderLoadingSpinner');
            if (spinnerElm) {
                spinnerElm.className = "d-none";
            }
        }

        asyncShow()
            .then(()=>{})
            .catch((err: any)=>{
                if ('Invalid Session'===err) {
                    navigate('/signon/')
                } else {
                    const errStr = `Failed creating order list: ${JSON.stringify(err)}`;
                    console.log(errStr);
                    alert(errStr);
                    throw err;
                }
            });
    }


    ////////////////////////////////////////////////////////////////////
    //
    private getActionButtons(order: any, frConfig: FundraiserConfig) {
        
        let htmlStr = `<div style="float: right">`;

        if (('mulch' === frConfig.kind()) && order.products?.spreading) {
            htmlStr +=
                `<button type="button" class="btn btn-outline-info me-1 order-spread-btn">` +
                `<svg class="bi" fill="currentColor"><use xlink:href="${spreadImg}" /></svg></button>`;
        }
        
        if (frConfig.isEditableDeliveryDate(order.deliveryId)) {
            htmlStr +=
                `<button type="button" class="btn btn-outline-info me-1 order-edt-btn">` +
                `<svg class="bi" fill="currentColor"><use xlink:href="${pencilImg}" /></svg></button>` +
                `<button type="button" class="btn btn-outline-danger order-del-btn">` +
                `<svg class="bi" fill="currentColor"><use xlink:href="${trashImg}" /></svg></button>`;
        } else {
            htmlStr +=
                `<button type="button" class="btn btn-outline-info me-1 order-view-btn">` +
                `<svg class="bi" fill="currentColor"><use xlink:href="${eyeImg}" /></svg></button>`;
        }

        htmlStr += `</div>`;
        return htmlStr;
    }

    ////////////////////////////////////////////////////////////////////
    //
    private registerActionButtonHandlers() {
        // Handle on Edit Scenario
        jQuery('#orderListTable').find('.order-edt-btn').on('click', (event: any)=>{
            const parentTr = jQuery(event.currentTarget).parents('tr');
            const row = this.currentDataTable_.row(parentTr);
            const orderId = row.data()[0];
            const orderOwner = row.data()[1];

            console.log(`Editing order for ${orderId}`);
            orderDb.setActiveOrder(); // Reset active order to let order edit for set it
            navigate('/order_step_1/', {state: {
                editOrderId: orderId,
                editOrderOwner: orderOwner
            }});
        });

        // Handle on View Scenario
        jQuery('#orderListTable').find('.order-view-btn').on('click', (event: any)=>{
            const parentTr = jQuery(event.currentTarget).parents('tr');
            const row = this.currentDataTable_.row(parentTr);
            const orderId = row.data()[0];

            console.log(`View order for ${orderId}`);
            orderDb.setActiveOrder(); // Reset active order to let order edit for set it
            navigate('/order_step_1/', {state: {editOrderId: orderId, isOrderReadOnly: true}});
        });

        // Handle on View Scenario
        jQuery('#orderListTable').find('.order-spread-btn').on('click', (event: any)=>{
            const parentTr = jQuery(event.currentTarget).parents('tr');
            const row = this.currentDataTable_.row(parentTr);
            const orderId = row.data()[0];
            console.log(`Spreading Dlg order for ${orderId}`);
            const dlgElm = document.getElementById(spreadingDlgRt);
            const spreadOrderDlg = new bs.Modal(dlgElm, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
            spreadOrderDlg.show();
        });

        // Handle On Delete Scenario
        jQuery('#orderListTable').find('.order-del-btn').on('click', (event: any)=>{
            const parentTr = jQuery(event.currentTarget).parents('tr');
            const row = this.currentDataTable_.row(parentTr);
            const orderId = row.data()[0];

            console.log(`Deleting order for ${orderId}`);
            jQuery('#confirmDeleteOrderInput').val('');
            parentTr.find('button').attr("disabled", true);

            const dlgElm = document.getElementById('deleteOrderDlg');
            const delOrderDlg = new bs.Modal(dlgElm, {
                backdrop: true,
                keyboard: true,
                focus: true
            });

            jQuery('#deleteDlgBtn')
                .prop("disabled",true)
                .off('click')
                .click(
                    (event: any)=>{
                        console.log(`Delete confirmed for: ${orderId}`);
                        delOrderDlg.hide();
                        orderDb.deleteOrder(orderId).then(()=>{
                            row.remove().draw();
                        }).catch((err: any)=>{
                            alert(`Failed to delete order: ${orderId}: ${err.message}`);
                            parentTr.find('button').attr("disabled", false);
                        });
                    }
                );

            const dlgHandler = (event)=>{
                parentTr.find('button').attr("disabled", false);
                dlgElm.removeEventListener('hidden.bs.modal', dlgHandler);
            };
            dlgElm.addEventListener('hidden.bs.modal', dlgHandler);

            delOrderDlg.show();
        });
    }

    ////////////////////////////////////////////////////////////////////
    //
    private async showDefault(frConfig: FundraiserConfig, userId?: string) {

        const currentUserId =  auth.getCurrentUserId();
        if (!userId) { userId = currentUserId; }
        // Build query fields
        const fieldNames = ["orderId", "firstName", "lastName"];
        fieldNames.push("deliveryId");
        if ('mulch' === frConfig.kind()) {
            fieldNames.push("products.spreading");
        }

        if ('any'===userId) {
            fieldNames.push("orderOwner");
        }


        this.currentQueryResults_ = await orderDb.query({fields: fieldNames, orderOwner: userId});
        const orders = this.currentQueryResults_;
        console.log(`Default Orders Page: ${JSON.stringify(orders)}`);

        // Fill out rows of data
        const orderDataSet = [];
        for (const order of orders) {
            const nameStr = `${order.firstName}, ${order.lastName}`;
            const ownerId = ('any'===userId)?order.orderOwner:userId;
            const orderDataItem = [order.orderId, ownerId, nameStr];
            //only reason to not have a delivery date is if it is a donation
            const deliveryDate = order.deliveryId?frConfig.deliveryDateFromId(order.deliveryId):'donation';
            orderDataItem.push(deliveryDate);

            if ('mulch' === frConfig.kind()) {
                orderDataItem.push((order.products?.spreading?order.products.spreading:''));
            }

            orderDataItem.push(this.getActionButtons(order, frConfig));
            orderDataSet.push(orderDataItem);
        }


        const tableColumns = [
            {
                title: "OrderId",
                visible: false
            },
            {
                title: "Order Owner",
                visible: ('any'!==userId || userId !== currentUserId),
                render: (data)=>{
                    //console.log(`Data: JSON.stringify(data)`);
                    return frConfig.getUserNameFromId(data);
                }
            },
            {
                title: "Name",
                className: "all"
            },
            {
                title: "Delivery Date"
            }
        ];

        if ('mulch' === frConfig.kind()) {
            tableColumns.push({ title: "Spreading" });
        }

        tableColumns.push({
            title: "Actions",
            "orderable": false,
            className: "all"
        });

        this.currentDataTable_ = jQuery('#orderListTable').DataTable({
            data: orderDataSet,
            paging: false,
            bInfo : false,
            columns: tableColumns
        });

        this.registerActionButtonHandlers();
    }

    ////////////////////////////////////////////////////////////////////
    //
    private async showFull(frConfig: FundraiserConfig, userId?: string) {

        const currentUserId =  auth.getCurrentUserId();
        if (!userId) { userId = currentUserId; }

        this.currentQueryResults_ = await orderDb.query();
        const orders = this.currentQueryResults_;

        console.log(`Full Orders Page: ${JSON.stringify(orders)}`);

        const getVal = (fld?: any, dflt?: any)=>{
            if (undefined===fld) {
                if (undefined===dflt) {
                    return '';
                } else {
                    return `${dflt}`;
                }
            } else {
                return `${fld}`;
            }
        };

        // Fill out rows of data
        const orderDataSet = [];
        for (const order of orders) {
            const nameStr = `${order.firstName}, ${order.lastName}`;

            const deliveryDate = order.deliveryId?frConfig.deliveryDateFromId(order.deliveryId):'donation';
            orderDataItem.push(deliveryDate);

            let orderDataItem = [
                order.orderId,
                order.orderOwner,
                nameStr,
                order.phone,
                getVal(order.email),
                order.addr1,
                getVal(order.addr2),
                deliveryDate
            ];

            if ('mulch' === frConfig.kind()) {
                orderDataItem.push(order.neighborhood);
                orderDataItem.push(getVal(order.products?.spreading, 0));
                orderDataItem.push(getVal(order.products?.bags, 0));
            } else {
                //TODO:  Add Products stuff like city, state, zip
            }

            orderDataItem = orderDataItem.concat([
                getVal(order.specialInstructions),
                USD(order.donation).format(),
                USD(order.cashPaid).format(),
                USD(order.checkPaid).format(),
                getVal(order.checkNums),
                USD(order.totalAmt).format(),
                (order.isValidated?"True":"False")
            ]);

            orderDataItem.push(this.getActionButtons(order, frConfig));
            orderDataSet.push(orderDataItem);
        }


        let tableColumns = [
            { title: "OrderId", visible: false },
            {
                title: "Order Owner",
                visible: ('any'!==userId || userId !== currentUserId)
            },
            { title: "Name"},
            { title: "Phone" },
            { title: "Email" },
            { title: "Address 1" },
            { title: "Address 2" },
            { title: "Delivery Date" }
        ];

        if ('mulch' === frConfig.kind()) {
            tableColumns.push({ title: "Neighborhood" });
            tableColumns.push({ title: "Spreading" });
            tableColumns.push({ title: "Bags" });
        }

        tableColumns = tableColumns.concat([
            { title: "Special Instructions" },
            { title: "Donations" },
            { title: "Cash" },
            { title: "Check" },
            { title: "Check Numbers" },
            { title: "Total Amount" },
            { title: "IsValidated" },

        ]);

        tableColumns.push({
            title: "Actions",
            "orderable": false,
            className: "all"
        });

        this.currentDataTable_ = jQuery('#orderListTable').DataTable({
            data: orderDataSet,
            paging: false,
            bInfo : false,
            columns: tableColumns
        });

        this.registerActionButtonHandlers();
    }

    ////////////////////////////////////////////////////////////////////
    //
    genCsvFromCurrent() {
        if (!this.currentDataTable_) { throw new Error("Table isn't found"); }
        let csvFileData = [];

        const headerElm = this.currentDataTable_.table().header();
        let csvRow = []
        for (const th of jQuery(headerElm).find(`th`)) {
            if ('Actions'===th.innerText) { continue; }
            console.log();
            csvRow.push(th.innerText);
        };
        csvRow = ['OrderId', 'OrderOwner'].concat(csvRow);
        csvFileData.push(csvRow.join('|'));

        const data = this.currentDataTable_.data().toArray();

        data.forEach((row, _)=>{
            csvRow = [];
            row.forEach((column, _)=>{
                csvRow.push(column);
            });
            csvRow.splice(-1,1);
            csvFileData.push(csvRow.join('|'));
        });

        //console.log(`${JSON.stringify(csvFileData, null, '\t')}`);
        return csvFileData;
    }

}

const reportViews: ReportViews = new ReportViews();

////////////////////////////////////////////////////////////////////
//
const genDeleteDlg = ()=>{
    // Check for enabling/disabling Delete From Button
    const doesDeleteBtnGetEnabled = (event: any)=>{
        if ('delete'===event.currentTarget.value) {
            (document.getElementById('deleteDlgBtn') as HTMLButtonElement).disabled = false;
        } else {
            (document.getElementById('deleteDlgBtn') as HTMLButtonElement).disabled = true;
        }
    };

    return(
        <div className="modal fade" id="deleteOrderDlg"
             tabIndex="-1" role="dialog" aria-labelledby="deleteOrderDlgTitle" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id="deleteOrderDlgLongTitle">
                            Confirm Order Deletion
                        </h5>
                        <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div className="modal-body">
                        <input type="text" className="form-control" id="confirmDeleteOrderInput"
                               placeholder="type delete to confirm"  autoComplete="fr-new-cust-info"
                               onInput={doesDeleteBtnGetEnabled} aria-describedby="confirmDeleteOrderHelp" />
                        <small id="confirmDeleteOrderHelp" className="form-text text-muted">
                            Enter "delete" to confirm order deletion.
                        </small>

                    </div>
                    <div className="modal-footer">
                        <button type="button" disabled className="btn btn-primary" id="deleteDlgBtn">
                            Delete Order
                        </button>
                        <button type="button" className="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


////////////////////////////////////////////////////////////////////
//
const showTheSelectedView = (frConfig: FundraiserConfig, isAdmin: boolean) => {

    const showView = ()=>{
        const userSelElm = document.getElementById(`${rprtStngDlgRt}UserSelection`);
        const viewSelElm = document.getElementById(`${rprtStngDlgRt}ViewSelection`);

        //Update the selected view label
        const selectedUser = userSelElm.options[userSelElm.selectedIndex].text;
        const selectedView = viewSelElm.options[viewSelElm.selectedIndex].text;
        const rvLabel = document.getElementById("reportViewLabel");
        console.log(`${selectedView}(${selectedUser})`);
        rvLabel.innerText = `${selectedView}(${selectedUser})`;

        const userIdOverride = userSelElm.options[userSelElm.selectedIndex].value;
        reportViews.showView(selectedView, frConfig, userIdOverride);
    };

    // Check to see if Report Views User view has been initialized
    if (!document.getElementById(`${rprtStngDlgRt}UserSelection`)) {
        const genOption = (label, val)=>{
            const option = document.createElement("option");
            option.text = label;
            if (val) { option.value = val; }
            return option;
        };

        auth.getUserIdAndGroups().then(([_, userGroups])=>{
            const userSelElm = document.getElementById(`${rprtStngDlgRt}UserSelection`);
            const viewSelElm = document.getElementById(`${rprtStngDlgRt}ViewSelection`);

            const fullName = frConfig.getUserNameFromId(auth.getCurrentUserId())

            if (userGroups && userGroups.includes("FrAdmins")) {
                for (const userInfo of frConfig.users()) {
                    userSelElm.add(genOption(userInfo[1], userInfo[0]));
                }
                userSelElm.add(genOption('All', 'any'));
                userSelElm.value = auth.getCurrentUserId();
                document.getElementById(`${rprtStngDlgRt}UserSelectionCol`).style.display = "inline-block";

                viewSelElm.add(genOption('Default'));
                viewSelElm.add(genOption('Full'));
                viewSelElm.selectedIndex = 0;
            } else {
                document.getElementById(`${rprtStngDlgRt}UserSelectionCol`).style.display = "none";
                userSelElm.add(genOption(fullName, auth.getCurrentUserId()));
                userSelElm.selectedIndex = 0;

                viewSelElm.add(genOption('Default'));
                viewSelElm.add(genOption('Full'));
                viewSelElm.selectedIndex = 0;
            }

            showView();
        });
    } else {
        showView();
    }

};

////////////////////////////////////////////////////////////////////
//
const genReportSettingsDlg = ()=>{
    return(
        <div className="modal fade" id={rprtStngDlgRt}
             tabIndex="-1" role="dialog" aria-labelledby={rprtStngDlgRt + "Title"} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id={rprtStngDlgRt + "LongTitle"}>
                            Switch report view settings
                        </h5>
                        <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="container-sm">
                            <div className="row">
                                <div className="col-sm">
                                    <div className="form-floating">
                                        <select className="form-control" id={rprtStngDlgRt+"ViewSelection"}/>
                                        <label htmlFor={rprtStngDlgRt+"ViewSelection"}>
                                            Select Report View
                                        </label>
                                    </div>
                                </div>
                                <div className="col-sm" id={rprtStngDlgRt+"UserSelectionCol"}>
                                    <div className="form-floating">
                                        <select className="form-control" id={rprtStngDlgRt+"UserSelection"} />
                                        <label htmlFor={rprtStngDlgRt+"UserSelection"}>
                                            Select User
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-primary"
                                data-bs-dismiss="modal" id={rprtStngDlgRt + "OnSave"}>
                            Save
                        </button>
                        <button type="button" className="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

////////////////////////////////////////////////////////////////////
//
const genSpreadingDlg = () => {
    return(
        <div className="modal fade" id={spreadingDlgRt}
             tabIndex="-1" role="dialog" aria-labelledby={spreadingDlgRt + "Title"} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title" id={spreadingDlgRt + "LongTitle"}>
                            Spreading Completion
                        </h5>
                        <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="container-sm">
                            <div className="row">
                                <div className="col-sm">
                                    <div className="form-floating">
                                        <div className="form-check form-switch">
                                            <input className="form-check-input" type="checkbox" id="isSpreadCheck" />
                                            <label className="form-check-label"
                                                   htmlFor="isSpreadCheck">Spreading Complete</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-primary"
                                data-bs-dismiss="modal" id={spreadingDlgRt + "OnSave"}>
                            Save
                        </button>
                        <button type="button" className="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

////////////////////////////////////////////////////////////////////
//
const genCardBody = (frConfig: FundraiserConfig) => {
    const fullName = frConfig.getUserNameFromId(auth.getCurrentUserId());

    const onVewSettingsClick = ()=>{
        auth.getUserIdAndGroups().then(([_, userGroups])=>{
            const dlgElm = document.getElementById(rprtStngDlgRt);
            reportSettingsDlg = new bs.Modal(dlgElm, {
                backdrop: true,
                keyboard: true,
                focus: true
            });

            document.getElementById(rprtStngDlgRt+"OnSave").onclick = (event)=>{
                showTheSelectedView(frConfig);
            }

            reportSettingsDlg.show();
        });
    };


    const onDownloadReportClick = ()=>{
        const csvData = reportViews.genCsvFromCurrent().join('\n');
        const hiddenElement = document.createElement('a');
        hiddenElement.href = 'data:text/plain;charset=utf-8,' + encodeURI(csvData);
        hiddenElement.target = '_blank';
        hiddenElement.download = 'FundraisingReport.text';
        hiddenElement.click();
    };


    return(
        <div className="card-body" id="cardReportBody">
            <h5 className="card-title ps-2" id="orderCardTitle">
                Reports View: <div style={{display: "inline"}} id="reportViewLabel">Default({fullName})</div>
                <button type="button" className="btn reports-view-setting-btn" onClick={onVewSettingsClick}>
                    <svg className="bi" fill="currentColor">
                        <use xlinkHref={reportSettingsImg}/>
                    </svg>
                </button>
                <button type="button" className="btn reports-view-setting-btn float-end" onClick={onDownloadReportClick}>
                    <svg className="bi" fill="currentColor">
                        <use xlinkHref={exportImg}/>
                    </svg>
                </button>

            </h5>



            <table id="orderListTable"
                   className="display responsive nowrap collapsed" role="grid" style={{width:"100%"}}/>




            <div className="spinner-border" role="status" id="orderLoadingSpinner">
                <span className="visually-hidden">Loading...</span>
            </div>
        </div>
    );
};


////////////////////////////////////////////////////////////////////
//
export default function orders() {

    const addNewOrder=()=>{
        console.log("Add new order");
        orderDb.newActiveOrder();
        navigate('/order_step_1/');
    };

    // Client-side Runtime Data Fetching
    const [cardBody, setCardBody] = useState();
    const [deleteDlg, setDeleteDlg] = useState();
    const [spreadDlg, setSpreadDlg] = useState();
    const [settingsDlg, setReportSettingsDlg] = useState();
    useEffect(() => {
        const frConfig = getFundraiserConfig();
        setCardBody(genCardBody(frConfig));
        setDeleteDlg(genDeleteDlg());
        setSpreadDlg(genSpreadingDlg());
        setReportSettingsDlg(genReportSettingsDlg());

        showTheSelectedView(frConfig);

    }, []);


    return (
        <div>
            <NavBar/>

            <button type="button"
                    className="btn btn-outline-primary add-order-btn"
                    onClick={addNewOrder}>
                <svg className="bi" fill="currentColor">
                    <use xlinkHref={addOrderImg}/>
                </svg>
            </button>

            <div className="col-xs-1 d-flex justify-content-center">
                <div className="card" style={{width: "100%"}}>
                    {cardBody}
                </div>
            </div>

            {deleteDlg}
            {settingsDlg}
            {spreadDlg}

        </div>
    );
}
