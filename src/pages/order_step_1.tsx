import React, { useState, useEffect } from "react"
import NavBar from "../components/navbar"
import {orderDb, Order} from "../js/ordersdb"
//import OrderItem from "../components/order_item" //TODO: Rename DeliveryOrderSummary
import { navigate } from "gatsby"
import currency from "currency.js"
import {FundraiserConfig, getFundraiserConfig} from "../js/fundraiser_config"


const USD = (value) => currency(value, { symbol: "$", precision: 2 });

/* <li className="list-group-item" id={deliveryId} key={deliveryId}>
 * <OrderItem onClick={onClickHandler} onDelete={recalculateTotal}
 * deliveryId={deliveryId} deliveryLabel={deliveryLabel} />
 * </li>
 *  */


const populateForm = (currentOrder: Order): any =>{

    const fundraiserConfig: FundraiserConfig = getFundraiserConfig();
    if (!fundraiserConfig) {
        alert("Failed to load fundraiser config");
        return(<div/>);
    }

    // Save off current order values
    const saveCurrentOrder = ()=>{
        currentOrder.firstName = (document.getElementById('formFirstName') as HTMLInputElement).value;
        currentOrder.lastName = (document.getElementById('formLastName') as HTMLInputElement).value;
        currentOrder.email = (document.getElementById('formEmail') as HTMLInputElement).value;
        currentOrder.phone = (document.getElementById('formPhone') as HTMLInputElement).value;
        currentOrder.addr1 = (document.getElementById('formAddr1') as HTMLInputElement).value;
        currentOrder.addr2 = (document.getElementById('formAddr2') as HTMLInputElement).value;
        /* currentOrder.city = (document.getElementById('formCity') as HTMLInputElement).value;
         * currentOrder.state = (document.getElementById('formState') as HTMLInputElement).value;
         * currentOrder.zip = (document.getElementById('formZip') as HTMLInputElement).value;
         * currentOrder.specialInstructions =
         *     (document.getElementById('formSpecialInstructions') as HTMLInputElement).value; */
        currentOrder.checkNumbers = (document.getElementById('formCheckNumbers') as HTMLInputElement).value;
        currentOrder.cashPaid =
            currency((document.getElementById('formCashPaid') as HTMLInputElement).value);
        currentOrder.checkPaid =
            currency((document.getElementById('formCheckPaid') as HTMLInputElement).value);
        console.log(`Current Order ${JSON.stringify(currentOrder, null, 2)}`);
    }

    // Handle Form Submission
    const onFormSubmission = (event: any) => {
        event.preventDefault();
        event.stopPropagation();

    }

    // Add New Product Order
    const onAddOrder = (event: any)=>{
        event.preventDefault();
        event.stopPropagation();

        saveCurrentOrder()

        const btn = event.currentTarget;

        let pageState = {state: {}};
        if (btn.dataset && btn.dataset.deliveryid) {
            const deliveryId = btn.dataset.deliveryid;
            console.log(`Add New Fundraising Order for ${deliveryId}`);
            pageState['deliveryid'] = deliveryId;
        }

        navigate('/add_products_order/', pageState);
    };

    // Add Donation to order
    const onAddDonation = (event: any)=>{
        event.preventDefault();
        event.stopPropagation();
        console.log(`Adding New Donation`);

        saveCurrentOrder()
        navigate('/add_donations/');
    };

    // Discard the order and go back to home
    const onDiscardOrder = ()=>{
        orderDb.setActiveOrder();
        navigate('/');
    };
    

    // Check for enabling/disabling submit button
    const doesSubmitGetEnabled = (event: any)=>{
        if (event.currentTarget.value) {
            (document.getElementById('formOrderSubmit') as HTMLButtonElement).disabled = false;
        } else {
            (document.getElementById('formOrderSubmit') as HTMLButtonElement).disabled = true;
        }
    };

    // Recalculate Total due dynamically based on changes to order status
    const recalculateTotal = ()=> {
        let totalDue = currency(0.0);
        for (let deliverable of currentOrder.orderByDelivery.values()) {
            console.log(`Found Order: ${deliverable.amountDue}`);
            totalDue = totalDue.add(deliverable.amountDue);
        }
        const totElm = document.getElementById('orderAmountDue');
        if (null!==totElm) {
            totElm.innerText = `Total Due: ${USD(totalDue).format()}`;
        }
    }

    // Create delivery status buttons
    const populateOrdersList = (): Array<any> => {
        const ordersByDeliveryBtns = []
        for (const [deliveryId, deliveryLabel] of fundraiserConfig.validDeliveryDates()) {
            const foundOrder = currentOrder.orderByDelivery.get(deliveryId);
            if (!foundOrder) { continue; }

            const foundTag = `found-${deliveryId}`
            const orderTotalStr = `${deliveryLabel} Amount: ${USD(foundOrder.amountDue).format()} `;

            // On Delete Order Re-enable button
            const onDeleteOrder = (event)=>{
                const deliveryIdToDel = event.currentTarget.dataset.deliveryid;
                
                console.log(`Deleting Order for ${deliveryIdToDel}`);

                currentOrder.orderByDelivery.delete(deliveryIdToDel);
                document.getElementById(foundTag).style.display = "none";
                if ('donation' === deliveryIdToDel) {
                    document.getElementById('addDonationBtnLi').style.display = "block";
                } else {
                    document.getElementById('addProductBtnLi').style.display = "block";
                }

                recalculateTotal();
            }

            //console.log(`Adding Order Type for DDay: ${deliveryId}`);
            const onClickHandler = ("donation" === deliveryId)? onAddDonation : onAddOrder;

            ordersByDeliveryBtns.push(
                <li className="list-group-item" id={foundTag} key={foundTag}>
                    {orderTotalStr}
                    <button className="btn btn-outline-danger mx-1 float-right order-edt-btn"
                            data-deliveryid={deliveryId} onClick={onDeleteOrder}>
                        <span>&#10005;</span>
                    </button>
                    <button className="btn btn-outline-info float-right order-edt-btn"
                            data-deliveryid={deliveryId} onClick={onClickHandler}>
                        <span>&#9999;</span>
                    </button>
                </li>
            );
        }

        // Figure out visibility
        const orderHasDonation = currentOrder.orderByDelivery.has('donation');
        const numProdOrders = orderHasDonation ?
                              currentOrder.orderByDelivery.size-1 :
                              currentOrder.orderByDelivery.size;
        
        const addProdDisplay = (0 !== (fundraiserConfig.numDeliveryDates()-numProdOrders)) ?
                               {display: 'block'}:{display: 'none'};
        const addDonationDisplay = (!orderHasDonation) ?
                                   {display: 'block'}:{display: 'none'};

        //Add the Add Product Button
        ordersByDeliveryBtns.push(
            <li className="list-group-item" id="addProductBtnLi" key="addProductBtnLi" style={addProdDisplay}>
                Add Product Order
                <button className="btn btn-outline-info float-right order-edt-btn" onClick={onAddOrder}>
                    <span>+</span>
                </button>
            </li>
        );

        //Add the Add Donation Button
        ordersByDeliveryBtns.push(
            <li className="list-group-item" id="addDonationBtnLi" key="addDonationBtnLi" style={addDonationDisplay}>
                Add Donations
                <button className="btn btn-outline-info float-right order-edt-btn" onClick={onAddDonation}>
                    <span>+</span>
                </button>
            </li>
        );

        return ordersByDeliveryBtns;
    };
    const ordersByDeliveryBtns = populateOrdersList();

    // Neighborhoods list creation
    const hoods=[];
    for (let hood of fundraiserConfig.neighborhoods()) {
        hoods.push(<option key={hood}>{hood}</option>);
    }

    
    // Calulate Current amountDue
    let newTotalDue = currency(0.0);
    for (const deliverable of currentOrder.orderByDelivery.values()) {
        console.log(`Found Order To Calc: ${deliverable.amountDue}`);
        newTotalDue = newTotalDue.add(deliverable.amountDue);
    }
    const amountDue = USD(newTotalDue).format();
    const amountPaid = USD(currentOrder.checkPaid.add(currentOrder.cashPaid)).format();
    console.log(`Amount Due: ${amountDue}  Paid: ${amountPaid}`);

    
    // This is if we support city, state, zip
    /* const stateAbbreviations = [
     *     'AL','AK','AS','AZ','AR','CA','CO','CT','DE','DC','FM','FL','GA',
     *     'GU','HI','ID','IL','IN','IA','KS','KY','LA','ME','MH','MD','MA',
     *     'MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
     *     'MP','OH','OK','OR','PW','PA','PR','RI','SC','SD','TN','TX','UT',
     *     'VT','VI','VA','WA','WV','WI','WY'
     * ];

     * const states=[];
     * for (let st of stateAbbreviations) {
     *     states.push(<option key={st}>{st}</option>);
     * } */
    /* const wreathInfo = ()=>(
     *     return(
     *         <Form.Row>
     *             <Form.Group as={Col} md="7" controlId="formCity">
     *                 <Form.Label>City</Form.Label>
     *                 <Form.Control required type="text" placeholder="City" defaultValue={currentOrder.city} />
     *             </Form.Group>

     *             <Form.Group as={Col} md="2" controlId="formState">
     *                 <Form.Label>State</Form.Label>
     *                 <Form.Control as="select" defaultValue='TX'>
     *                     {states}
     *                 </Form.Control>
     *             </Form.Group>

     *             <Form.Group as={Col} md="3" controlId="formZip">
     *                 <Form.Label>Zip</Form.Label>
     *                 <Form.Control type="text" placeholder="Zip" defaultValue={currentOrder.zip} />
     *             </Form.Group>
     *         </Form.Row>
     *     );
     * ); */
    

    return(
        <form onSubmit={onFormSubmission}>
            
            <div className="form-row">
                <div className="form-group col-md-6">
                    <label htmlFor="formFirstName">First Name</label>
                    <input className="form-control" type="text" id="formFirstName"
                           required
                           placeholder="First Name"
                           defaultValue={currentOrder.firstName}
                           onInput={doesSubmitGetEnabled}
                           aria-describedby="formFirstNameHelp" />
                    <small id="formFirstNameHelp" className="form-text text-muted">*required</small>
                </div>
                <div className="form-group col-md-6">
                    <label htmlFor="formLastName">Last Name</label>
                    <input className="form-control" type="text" id="formLastName"
                           required
                           placeholder="Last Name"
                           defaultValue={currentOrder.lastName}
                           onInput={doesSubmitGetEnabled}
                           aria-describedby="formLastNameHelp" />
                    <small id="formLastNameHelp" className="form-text text-muted">*required</small>
                </div>
            </div>

            <div className="form-row">
                <div className="form-group col-md-6">
                    <label htmlFor="formAddr1">Phone</label>
                    <input className="form-control" type="text" id="formAddr1"
                           required
                           placeholder="Address 1"
                           defaultValue={currentOrder.addr1}
                           onInput={doesSubmitGetEnabled}
                           aria-describedby="formAddr1Help" />
                    <small id="formAddr1Help" className="form-text text-muted">*required</small>
                </div>
                <div className="form-group col-md-6">
                    <label htmlFor="formAddr2">Address 2</label>
                    <input className="form-control" type="text" id="formAddr2"
                           placeholder="Address 2"
                           defaultValue={currentOrder.addr2}/>
                </div>
            </div>

            <div className="form-row">
                <div className="form-group col-md-4">
                    <label htmlFor="formNeighborhood">Neighborhood</label>
                    <select className="form-control" id="formNeighborhood" aria-describedby="formNeighborhoodHelp">
                        {hoods}
                    </select>
                    <small id="formNeighborhoodHelp" className="form-text text-muted">*required</small>
                </div>
                <div className="form-group col-md-4">
                    <label htmlFor="formPhone">Phone</label>
                    <input className="form-control" type="text" id="formPhone"
                           required
                           placeholder="Phone"
                           defaultValue={currentOrder.phone}
                           onInput={doesSubmitGetEnabled}
                           aria-describedby="formPhoneHelp" />
                    <small id="formPhoneHelp" className="form-text text-muted">*required</small>
                </div>
                <div className="form-group col-md-4">
                    <label htmlFor="formEmail">Email</label>
                    <input className="form-control" type="text" id="formEmail"
                           placeholder="Email"
                           defaultValue={currentOrder.email}/>
                </div>
            </div>


            <div className="form-row">
                <div className="form-group col-md-4">
                    <label htmlFor="formCashPaid">Total Cash Amount</label>
                    <input className="form-control" type="text"
                           id="formCashPaid" placeholder="Total Cash Amount"
                           defaultValue={currentOrder.cashPaid.toString()}/>
                </div>
                <div className="form-group col-md-4">
                    <label htmlFor="formCheckPaid">Total Check Amount</label>
                    <input className="form-control" type="text"
                           id="formCheckPaid" placeholder="Total Check Amount"
                           defaultValue={currentOrder.checkPaid.toString()}/>
                </div>
                <div className="form-group col-md-4">
                    <label htmlFor="formCheckNumbers">Enter Check Numbers</label>
                    <input className="form-control" type="text"
                           id="formCheckNumbers" placeholder="Enter Check #s"
                           defaultValue={currentOrder.checkNumbers}/>
                </div>
            </div>

            <ul className="list-group">
                {ordersByDeliveryBtns}
            </ul>

            <div className="pt-3 col-xs-1 d-flex">
                <div className="col-md-6" id="orderAmountDue">Total Due: {amountDue}</div>
                <div className="col-md-6" id="orderAmountPaid">Total Paid: {amountPaid}</div>
            </div>

            <div className="pt-4">
                <button type="button" className="btn btn-primary" onClick={onDiscardOrder}>
                    Discard
                </button>
                <button type="submit" className="btn btn-primary my-2 float-right" id="formOrderSubmit">
                    Submit
                </button>
            </div>
        </form>
    );
}



export default (params: any)=>{

    // Calculate Initial total due and amount paid from orders at page load time
    const [formFields, setFormFields] = useState();
    useEffect(() => {
        const order = orderDb.getActiveOrder();
        if (undefined===order) {
            const dbOrderId = params?.location?.state?.editOrderId;
            if (dbOrderId) {
                orderDb.getOrderFromId(dbOrderId).then((order: Order|undefined)=>{
                    console.log(`Returned Order: ${JSON.stringify(order)}`);
                    if (order) {
                        orderDb.setActiveOrder(order);
                        setFormFields(populateForm(order));
                    } else {
                        alert(`Order: ${dbOrderId} could not be retrieved`);
                        navigate('/orders/');
                    }
                });
            } else {
                alert("Failed to retrieve active order");
                navigate('/');
            }
        } else {
            setFormFields(populateForm(order));
        }
    }, [])    

    return (
        <div>
            <NavBar/>
            <div className="col-xs-1 d-flex justify-content-center">
                <div className="card">
                    <div className="card-body">
                        <h5 className="card-title">Customer Information</h5>
                        {formFields}
                    </div>
                </div>
            </div>

            <div className="modal" tabIndex="-1" role="dialog">
                <div className="modal-dialog" role="document">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Enter Neighborhood</h5>
                            <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Modal body text goes here.</p>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-primary">Save changes</button>
                            <button type="button" className="btn btn-secondary" data-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
    );


}
