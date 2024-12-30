'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Menu, TrendingUp } from 'lucide-react';
import { Badge } from '@kit/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

export default function DashboardDemo() {
  const mrr = useMemo(() => generateDemoData(), []);
  const netRevenue = useMemo(() => generateDemoData(), []);
  const fees = useMemo(() => generateDemoData(), []);
  const newCustomers = useMemo(() => generateDemoData(), []);

  return (
    <div className={'flex flex-col space-y-4 pb-36 duration-500 animate-in fade-in'}>
      <div className={'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'}>
        <Card>
          <CardHeader>
            <CardTitle className={'flex items-center gap-2.5'}>
              <span>MRR</span>
              <Trend trend={'up'}>20%</Trend>
            </CardTitle>

            <CardDescription>
              <span>Monthly recurring revenue</span>
            </CardDescription>

            <div>
              <Figure>{`$${mrr[1]}`}</Figure>
            </div>
          </CardHeader>
        </Card>

        {/* Similar cards for netRevenue, fees, and newCustomers */}
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Best Customers</CardTitle>
            <CardDescription>Showing the top customers by MRR</CardDescription>
          </CardHeader>

          <CardContent>
            <CustomersTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function generateDemoData() {
  const today = new Date();
  const formatter = new Intl.DateTimeFormat('en-us', {
    month: 'long',
    year: '2-digit',
  });

  const data: { value: string; name: string }[] = [];

  for (let n = 8; n > 0; n -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - n, 1);

    data.push({
      name: formatter.format(date),
      value: (Math.random() * 10).toFixed(1),
    });
  }

  const lastValue = data[data.length - 1]?.value;

  return [data, lastValue] as [typeof data, string];
}

function Figure(props: React.PropsWithChildren) {
  return (
    <div className={'font-heading text-2xl font-semibold'}>
      {props.children}
    </div>
  );
}

function Trend(
  props: React.PropsWithChildren<{
    trend: 'up' | 'down' | 'stale';
  }>,
) {
  const Icon = useMemo(() => {
    switch (props.trend) {
      case 'up':
        return <ArrowUp className={'h-3 w-3 text-green-500'} />;
      case 'down':
        return <ArrowDown className={'h-3 w-3 text-destructive'} />;
      case 'stale':
        return <Menu className={'h-3 w-3 text-orange-500'} />;
    }
  }, [props.trend]);

  return (
    <div>
      <BadgeWithTrend trend={props.trend}>
        <span className={'flex items-center space-x-1'}>
          {Icon}
          <span>{props.children}</span>
        </span>
      </BadgeWithTrend>
    </div>
  );
}

function BadgeWithTrend(props: React.PropsWithChildren<{ trend: string }>) {
  const className = useMemo(() => {
    switch (props.trend) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-destructive';
      case 'stale':
        return 'text-orange-500';
    }
  }, [props.trend]);

  return (
    <Badge
      variant={'outline'}
      className={'border-transparent px-1.5 font-normal'}
    >
      <span className={className}>{props.children}</span>
    </Badge>
  );
}

function CustomersTable() {
  const customers = [
    {
      name: 'John Doe',
      email: 'john@makerkit.dev',
      plan: 'Pro',
      mrr: '$120.5',
      logins: 1020,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Emma Smith',
      email: 'emma@makerit.dev',
      plan: 'Basic',
      mrr: '$65.4',
      logins: 570,
      status: 'Possible Churn',
      trend: 'stale',
    },
    {
      name: 'Robert Johnson',
      email: 'robert@makerkit.dev',
      plan: 'Pro',
      mrr: '$500.1',
      logins: 2050,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Olivia Brown',
      email: 'olivia@makerkit.dev',
      plan: 'Basic',
      mrr: '$10',
      logins: 50,
      status: 'Churn',
      trend: 'down',
    },
    {
      name: 'Michael Davis',
      email: 'michael@makerkit.dev',
      plan: 'Pro',
      mrr: '$300.2',
      logins: 1520,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Emily Jones',
      email: 'emily@makerkit.dev',
      plan: 'Pro',
      mrr: '$75.7',
      logins: 780,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Daniel Garcia',
      email: 'daniel@makerkit.dev',
      plan: 'Basic',
      mrr: '$50',
      logins: 320,
      status: 'Possible Churn',
      trend: 'stale',
    },
    {
      name: 'Liam Miller',
      email: 'liam@makerkit.dev',
      plan: 'Pro',
      mrr: '$90.8',
      logins: 1260,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Emma Clark',
      email: 'emma@makerkit.dev',
      plan: 'Basic',
      mrr: '$0',
      logins: 20,
      status: 'Churn',
      trend: 'down',
    },
    {
      name: 'Elizabeth Rodriguez',
      email: 'liz@makerkit.dev',
      plan: 'Pro',
      mrr: '$145.3',
      logins: 1380,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'James Martinez',
      email: 'james@makerkit.dev',
      plan: 'Pro',
      mrr: '$120.5',
      logins: 940,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Charlotte Ryan',
      email: 'carlotte@makerkit.dev',
      plan: 'Basic',
      mrr: '$80.6',
      logins: 460,
      status: 'Possible Churn',
      trend: 'stale',
    },
    {
      name: 'Lucas Evans',
      email: 'lucas@makerkit.dev',
      plan: 'Pro',
      mrr: '$210.3',
      logins: 1850,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Sophia Wilson',
      email: 'sophia@makerkit.dev',
      plan: 'Basic',
      mrr: '$10',
      logins: 35,
      status: 'Churn',
      trend: 'down',
    },
    {
      name: 'William Kelly',
      email: 'will@makerkit.dev',
      plan: 'Pro',
      mrr: '$350.2',
      logins: 1760,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Oliver Thomas',
      email: 'olly@makerkit.dev',
      plan: 'Pro',
      mrr: '$145.6',
      logins: 1350,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Samantha White',
      email: 'sam@makerkit.dev',
      plan: 'Basic',
      mrr: '$60.3',
      logins: 425,
      status: 'Possible Churn',
      trend: 'stale',
    },
    {
      name: 'Benjamin Lewis',
      email: 'ben@makerkit.dev',
      plan: 'Pro',
      mrr: '$175.8',
      logins: 1600,
      status: 'Healthy',
      trend: 'up',
    },
    {
      name: 'Zoe Harris',
      email: 'zoe@makerkit.dev',
      plan: 'Basic',
      mrr: '$0',
      logins: 18,
      status: 'Churn',
      trend: 'down',
    },
    {
      name: 'Zachary Nelson',
      email: 'zac@makerkit.dev',
      plan: 'Pro',
      mrr: '$255.9',
      logins: 1785,
      status: 'Healthy',
      trend: 'up',
    },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>MRR</TableHead>
          <TableHead>Logins</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.name}>
            <TableCell className={'flex flex-col'}>
              <span>{customer.name}</span>
              <span className={'text-sm text-muted-foreground'}>
                {customer.email}
              </span>
            </TableCell>
            <TableCell>{customer.plan}</TableCell>
            <TableCell>{customer.mrr}</TableCell>
            <TableCell>{customer.logins}</TableCell>
            <TableCell>
              <BadgeWithTrend trend={customer.trend}>
                {customer.status}
              </BadgeWithTrend>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
