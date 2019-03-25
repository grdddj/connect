/* @flow */

import * as POPUP from '../constants/popup';
import * as UI from '../constants/ui';

import { parseMessage } from '../message';
import { UiMessage } from '../message/builder';
import DataManager from '../data/DataManager';
import { getOrigin } from '../utils/networkUtils';

import * as view from './view';
import { showView, postMessage, setOperation, initMessageChannel, postMessageToParent } from './view/common';
import { showFirmwareUpdateNotification, showBridgeUpdateNotification, showBackupNotification } from './view/notification';

import type { CoreMessage, PostMessageEvent } from '../types';
import type { PopupInit, PopupHandshake } from '../types/uiRequest';

// eslint-disable-next-line no-unused-vars
import styles from '../../styles/popup.less';

// handle messages from window.opener and iframe
const handleMessage = (event: PostMessageEvent): void => {
    console.warn('HANDLE MESSAGE IN POPUP', event);
    const data: any = event.data;
    if (!data) return;

    // This is message from the window.opener
    if (data.type === POPUP.INIT) {
        init(data.payload); // eslint-disable-line no-use-before-define
        return;
    }

    // ignore messages from origin other then parent.window or whitelisted
    const isMessagePort = event.target instanceof MessagePort || event.target instanceof BroadcastChannel;
    if (!isMessagePort && getOrigin(event.origin) !== getOrigin(document.referrer) && !DataManager.isWhitelisted(event.origin)) return;

    // catch first message from iframe
    if (data.type === POPUP.HANDSHAKE) {
        handshake(data.payload); // eslint-disable-line no-use-before-define
        return;
    }

    const message: CoreMessage = parseMessage(event.data);

    switch (message.type) {
        case UI.LOADING :
        case UI.REQUEST_UI_WINDOW :
            showView('loader');
            break;
        case UI.SET_OPERATION :
            if (typeof message.payload === 'string') { setOperation(message.payload); }
            break;
        case UI.TRANSPORT :
            showView('transport');
            break;
        case UI.SELECT_DEVICE :
            view.selectDevice(message.payload);
            break;
        case UI.SELECT_ACCOUNT :
            view.selectAccount(message.payload);
            break;
        case UI.SELECT_FEE :
            view.selectFee(message.payload);
            break;
        case UI.UPDATE_CUSTOM_FEE :
            view.updateCustomFee(message.payload);
            break;
        case UI.INSUFFICIENT_FUNDS :
            showView('insufficient-funds');
            break;
        case UI.REQUEST_BUTTON :
            view.requestButton(message.payload);
            break;
        case UI.BOOTLOADER :
            showView('bootloader');
            break;
        case UI.NOT_IN_BOOTLOADER :
            showView('not-in-bootloader');
            break;
        case UI.INITIALIZE :
            showView('initialize');
            break;
        case UI.SEEDLESS :
            showView('seedless');
            break;
        case UI.FIRMWARE_NOT_INSTALLED :
            showView('firmware-install');
            break;
        case UI.FIRMWARE_OLD :
            view.firmwareRequiredUpdate(message.payload);
            break;
        case UI.FIRMWARE_NOT_SUPPORTED :
            view.firmwareNotSupported(message.payload);
            break;
        case UI.FIRMWARE_NOT_COMPATIBLE :
            view.firmwareNotCompatible(message.payload);
            break;
        case UI.FIRMWARE_OUTDATED :
            showFirmwareUpdateNotification(message.payload);
            break;
        case UI.DEVICE_NEEDS_BACKUP :
            showBackupNotification(message.payload);
            break;
        case UI.BROWSER_NOT_SUPPORTED :
        case UI.BROWSER_OUTDATED :
            view.initBrowserView(message.payload);
            break;

        case UI.REQUEST_PERMISSION :
            view.initPermissionsView(message.payload);
            break;
        case UI.REQUEST_CONFIRMATION :
            view.initConfirmationView(message.payload);
            break;
        case UI.REQUEST_PIN :
            view.initPinView(message.payload);
            break;
        case UI.REQUEST_WORD :
            view.initWordView(message.payload);
            break;
        case UI.INVALID_PIN :
            showView('invalid-pin');
            break;
        case UI.REQUEST_PASSPHRASE :
            view.initPassphraseView(message.payload);
            break;
        case UI.REQUEST_PASSPHRASE_ON_DEVICE :
            view.passphraseOnDeviceView(message.payload);
            break;
        case UI.INVALID_PASSPHRASE :
            view.initInvalidPassphraseView(message.payload);
            break;
    }
};

// handle POPUP.INIT message from window.opener
const init = async (payload: $PropertyType<PopupInit, 'payload'>) => {
    if (!payload) return;
    try {
        // load assets
        await DataManager.load(payload.settings);
        // initialize message channel
        const broadcastID = `${payload.settings.env}-${payload.settings.timestamp}`;
        initMessageChannel(broadcastID, handleMessage);
        // reset loading hash
        window.location.hash = '';
        // handshake with iframe
        postMessage(new UiMessage(POPUP.HANDSHAKE));
    } catch (error) {
        postMessageToParent(new UiMessage(POPUP.ERROR, { error: error.message || error }));
    }
};

// handle POPUP.HANDSHAKE message from iframe
const handshake = async (payload: $PropertyType<PopupHandshake, 'payload'>) => {
    if (!payload) return;
    setOperation(payload.method || '');
    if (payload.transport && payload.transport.outdated) {
        showBridgeUpdateNotification();
    }
    // postMessage(new UiMessage(POPUP.HANDSHAKE));
};

const onLoad = () => {
    console.log('OPENER ' + window.opener + ' ref: ' + window.parent);
    // unsupported browser, this hash was set in parent app (PopupManager)
    // display message and do not continue
    if (window.location.hash === '#unsupported') {
        view.initBrowserView({
            name: '',
            osname: '',
            outdated: false,
            supported: false,
            mobile: false,
        });
        return;
    }

    postMessageToParent(new UiMessage(POPUP.LOADED));
};

window.addEventListener('load', onLoad, false);
window.addEventListener('message', handleMessage, false);

// global method used in html-inline elements
window.closeWindow = () => {
    setTimeout(() => {
        window.postMessage({ type: POPUP.CLOSE_WINDOW }, window.location.origin);
        window.close();
    }, 100);
};

