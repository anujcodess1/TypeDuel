import React, { lazy } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Props {
  data: { second: number; wpm: number }[];
}

export default function ResultChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="second"
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          label={{ value: 'seconds', position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 11 }}
        />
        <YAxis
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text)',
          }}
          formatter={(value: number) => [`${value} WPM`, 'WPM']}
          labelFormatter={(l) => `${l}s`}
        />
        <Line
          type="monotone"
          dataKey="wpm"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--accent)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
