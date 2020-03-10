/**
 * NOTICE OF LICENSE
 *
 * This source file is subject to the MIT License
 * It is available through the world-wide-web at this URL:
 * https://tldrlegal.com/license/mit-license
 * If you are unable to obtain it through the world-wide-web, please send an email
 * to support@buckaroo.nl so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade this module to newer
 * versions in the future. If you wish to customize this module for your
 * needs please contact support@buckaroo.nl for more information.
 *
 * @copyright Copyright (c) Buckaroo B.V.
 * @license   https://tldrlegal.com/license/mit-license
 */
/*browser:true*/
/*global define*/
define(
    [
        'jquery',
        'Magento_Checkout/js/view/payment/default',
        'Magento_Checkout/js/model/payment/additional-validators',
        'Buckaroo_Magento2/js/action/place-order',
        'ko',
        'Magento_Checkout/js/checkout-data',
        'Magento_Checkout/js/action/select-payment-method',
        'Magento_Checkout/js/model/quote',
        'Magento_Ui/js/model/messageList',
        'mage/translate',
        'mage/url',
        'Magento_Checkout/js/action/get-totals'
    ],
    function (
        $,
        Component,
        additionalValidators,
        placeOrderAction,
        ko,
        checkoutData,
        selectPaymentMethodAction,
        quote, 
        globalMessageList,
        $t,
        url,
        getTotalsAction
    ) {
        'use strict';

        function checkPayments(){
            var p = ["afterpay","afterpay2","afterpay20","klarnakp","capayableinstallments"];
            p.forEach(function(item) {
                $('.buckaroo_magento2_'+item).remove();
            });
        }

        return Component.extend(
            {
                defaults: {
                    alreadyFullPayed : null,
                    CardNumber: null,
                    Pin:        null,
                    template: 'Buckaroo_Magento2/payment/buckaroo_magento2_giftcards'
                },
                giftcards: [],
                allgiftcards: [],
                redirectAfterPlaceOrder: false,
                paymentFeeLabel : window.checkoutConfig.payment.buckaroo.giftcards.paymentFeeLabel,
                currencyCode : window.checkoutConfig.quoteData.quote_currency_code,
                baseCurrencyCode : window.checkoutConfig.quoteData.base_currency_code,
                currentGiftcard : false,
                alreadyPayed : false,
                
                /**
             * @override
             */
                initialize : function (options) {
                    if (checkoutData.getSelectedPaymentMethod() == options.index) {
                        window.checkoutConfig.buckarooFee.title(this.paymentFeeLabel);
                    }

                    return this._super(options);
                },

                initObservable: function () {
                    this._super().observe(['alreadyFullPayed','CardNumber','Pin','allgiftcards']);

                    this.allgiftcards = ko.observableArray(window.checkoutConfig.payment.buckaroo.avaibleGiftcards);

                    var self = this;
                    this.setCurrentGiftcard = function (value) {
                        self.currentGiftcard = value;
                        return true;
                    };

                    quote.totals._latestValue.total_segments.forEach(function(item) {
                        if(item.code == 'buckaroo_already_paid' && Math.round(item.value) >= Math.round(quote.totals._latestValue.grand_total)){
                            self.alreadyPayed = true;
                            self.alreadyFullPayed(true);
                        }
                    });

                    /** Check used to see if input is valid **/
                    this.buttoncheck = ko.computed(
                        function () {
                            return (
                                this.alreadyFullPayed() !== null
                            );
                        },
                        this
                    );
                    return this;
                },

                getGiftcardType: ko.observable(function () {
                    return this.currentGiftcard;
                }),

            /**
             * Place order.
             *
             * placeOrderAction has been changed from Magento_Checkout/js/action/place-order to our own version
             * (Buckaroo_Magento2/js/action/place-order) to prevent redirect and handle the response.
             */

                placeOrder: function (data, event) {

                    var self = this,
                    placeOrder;

                    if (event) {
                        event.preventDefault();
                    }

                    if (this.validate() && additionalValidators.validate()) {
                        this.isPlaceOrderActionAllowed(false);
                        placeOrder = placeOrderAction(this.getData(), this.redirectAfterPlaceOrder, this.messageContainer);

                        $.when(placeOrder).fail(
                            function () {
                                self.isPlaceOrderActionAllowed(true);
                            }
                        ).done(this.afterPlaceOrder.bind(this));
                        return true;
                    }
                    return false;
                },

                afterPlaceOrder: function () {
                    var response = window.checkoutConfig.payment.buckaroo.response;
                    response = $.parseJSON(response);
                    if (response.RequiredAction !== undefined && response.RequiredAction.RedirectURL !== undefined) {
                        window.location.replace(response.RequiredAction.RedirectURL);
                    }

                    if(this.alreadyPayed){
                        window.location.replace(url.build('checkout/onepage/success/'));
                    }

                },

                selectGiftCardPaymentMethod: function (code) {
                    this.setCurrentGiftcard(code);
                    this.getGiftcardType(code);
                    this.item.method = 'buckaroo_magento2_giftcards';
                    this.paymentMethod = this.item.method;
                    window.checkoutConfig.buckarooFee.title('Fee');
                    selectPaymentMethodAction({
                        "method": this.item.method,
                        "additional_data": {
                            "giftcard_method" : code
                        }
                    });
                    checkoutData.setSelectedPaymentMethod(this.item.method);
                    return true;
                },

                selectPaymentMethod: function () {
                    window.checkoutConfig.buckarooFee.title(this.paymentFeeLabel);
                    selectPaymentMethodAction(this.getData());
                    checkoutData.setSelectedPaymentMethod(this.item.method);
                    return true;
                },

                isGroupGiftcards: function () {
                    return window.checkoutConfig.payment.buckaroo.groupGiftcards !== undefined && window.checkoutConfig.payment.buckaroo.groupGiftcards == 1 ? true : false;
                },

                payWithBaseCurrency: function () {
                    var allowedCurrencies = window.checkoutConfig.payment.buckaroo.giftcards.allowedCurrencies;

                    return allowedCurrencies.indexOf(this.currencyCode) < 0;
                },

                getPayWithBaseCurrencyText: function () {
                    var text = $.mage.__('The transaction will be processed using %s.');

                    return text.replace('%s', this.baseCurrencyCode);
                },
                
                getData: function () {
                    return {
                        "method": this.item.method,
                        "po_number": null,
                        "additional_data": {
                            "giftcard_method" : (this.currentGiftcard !== undefined) ? this.currentGiftcard : null
                        }
                    };
                },

                alreadyFullPayed: function (state = false) {
                    return state;
                },

                applyGiftcard: function (data, event) {
                    self = this;

                    $.ajax({
                        url: "/buckaroo/checkout/giftcard",
                        type: 'POST',
                        dataType: 'json',
                        showLoader: true, //use for display loader 
                        data: {
                            card: self.currentGiftcard,
                            cardNumber: self.CardNumber._latestValue,
                            pin: self.Pin._latestValue
                        }
                   }).done(function (data) {

                        if(data.alreadyPaid){
                            if(data.RemainderAmount == null){
                                self.alreadyPayed = true;
                                self.alreadyFullPayed(true);
                            }

                            /* Totals summary reloading */
                            var deferred = $.Deferred();
                            getTotalsAction([], deferred);

                            checkPayments();
                        }
                        if(data.error){
                             self.messageContainer.addErrorMessage({'message': $t(data.error)});
                        }else{
                             self.messageContainer.addSuccessMessage({'message': $t(data.message)});
                        }
                    
                    });

                },
                checkForPayments: function () {
                    setTimeout(function() {
                        quote.totals._latestValue.total_segments.forEach(function(item) {
                            if(item.code == 'buckaroo_already_paid' && Math.round(item.value) > 0){
                                checkPayments();
                            }
                        });
                    }, 500);
                }
            }
        );
    }
);


