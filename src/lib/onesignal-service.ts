
'use server';

const ONE_SIGNAL_APP_ID = "af7c8099-b2c1-4376-be91-afb88be83161";
const ONE_SIGNAL_REST_API_KEY = "os_v2_app_v56ibgnsyfbxnpurv64ix2brmfly2gbjmtnufmnbwmpmhdu777cltwrkxkgzqfvbsy3kjuw2uqydfmkbhtemucc2ka5dl34tfal6hlq";

if (!ONE_SIGNAL_APP_ID || !ONE_SIGNAL_REST_API_KEY) {
    console.warn("[OneSignal Service] OneSignal environment variables (ONE_SIGNAL_APP_ID, ONE_SIGNAL_REST_API_KEY) are not set. Push notifications will be simulated.");
}

interface NotificationPayload {
    title: string;
    body: string;
    link?: string; // Optional link
    data?: Record<string, any>; // Optional custom data
}

async function sendNotification(notification: any) {
    if (!ONE_SIGNAL_APP_ID || !ONE_SIGNAL_REST_API_KEY) {
        console.log(`[OneSignal Service] SIMULATING SEND:`, notification.headings.en, '->', notification.contents.en, 'to', notification.include_external_user_ids || 'all');
        return;
    }

    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`,
    };

    const body = JSON.stringify({
        app_id: ONE_SIGNAL_APP_ID,
        ...notification,
    });

    try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers,
            body,
        });

        const responseData = await response.json();
        if (response.ok) {
            console.log('[OneSignal Service] Notification sent successfully:', responseData);
        } else {
            console.error('[OneSignal Service] Failed to send notification:', responseData);
        }
    } catch (error) {
        console.error('[OneSignal Service] Error sending notification:', error);
    }
}


export async function sendNotificationToAll(payload: NotificationPayload) {
    console.log(`[OneSignal Service] Sending notification to all users: "${payload.title}"`);
    await sendNotification({
        included_segments: ['Subscribed Users'],
        headings: { en: payload.title },
        contents: { en: payload.body },
        web_url: payload.link,
        data: payload.data,
    });
}

export async function sendNotificationToUser(userId: string, payload: NotificationPayload) {
    const lowerCaseUserId = userId.toLowerCase();
    console.log(`[OneSignal Service] Sending notification to user ${lowerCaseUserId}: "${payload.title}"`);
    await sendNotification({
        include_external_user_ids: [lowerCaseUserId],
        headings: { en: payload.title },
        contents: { en: payload.body },
        web_url: payload.link,
        data: payload.data
    });
}
