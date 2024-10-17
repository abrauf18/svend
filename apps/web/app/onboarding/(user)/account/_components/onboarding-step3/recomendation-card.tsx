import React from "react";
import { Trans } from '@kit/ui/trans';
import {Card, CardHeader, CardDescription, CardTitle} from '@kit/ui/card';


export function RecomendationCard( props: { title: string; description: string; }) {
    return (
        <Card className="w-[191px] h-[160px] rounded-b-[16px]">
            <CardHeader>
                <CardTitle>
                    <Trans i18nKey={props.title} />
                </CardTitle>
                <CardDescription>
                    <Trans i18nKey={props.description} />
                </CardDescription>
            </CardHeader>
        </Card>
    );
}