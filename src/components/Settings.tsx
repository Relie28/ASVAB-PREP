"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { loadUserModel, saveUserModel } from '@/lib/decision-engine';
import { getAiEventLog, getAiStatus } from '@/ai/generateProblem';
import { useToast } from '@/hooks/use-toast';

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [persistGenerated, setPersistGenerated] = useState(false);
  const [aiStatus, setAiStatus] = useState<any>({ sdkAvailable: false, endpoint: null, fallbackCount: 0 });
  const { toast } = useToast();

  useEffect(() => {
    try {
      const u = loadUserModel();
      if (u && u.preferences && typeof u.preferences.aiEnabled === 'boolean') {
        setAiEnabled(u.preferences.aiEnabled);
        setSaveToProfile(true);
      } else {
  const raw = localStorage.getItem('ai_enabled');
        setAiEnabled(raw === null ? true : raw === 'true');
  const rawPersist = localStorage.getItem('ai_persist_generated');
  setPersistGenerated(rawPersist === 'true');
        setSaveToProfile(false);
      }
    } catch (e) {}
    (async () => {
      try { const st = await getAiStatus(); setAiStatus(st); } catch (e) {}
    })();
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('ai_enabled', String(aiEnabled));
      localStorage.setItem('ai_persist_generated', String(persistGenerated));
    } catch (e) {}
    if (saveToProfile) {
      try {
        const u = loadUserModel();
        u.preferences = u.preferences || {};
        u.preferences.aiEnabled = aiEnabled;
        saveUserModel(u);
      } catch (e) {}
    }
    toast({ title: 'Settings saved' });
    setOpen(false);
  };

  const handleResetLogs = () => {
    try {
      localStorage.removeItem('ai_event_log');
      setAiStatus({ ...aiStatus, fallbackCount: 0 });
      toast({ title: 'AI logs reset' });
    } catch (e) {}
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Settings</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage AI preference and other settings</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">AI Generator</div>
              <div className="text-sm text-gray-600">Toggle client-side AI generation for adaptive problems.</div>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={(v) => setAiEnabled(!!v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Save to profile</div>
              <div className="text-sm text-gray-600">Save this AI preference in your user model (persist across devices if enabled).</div>
            </div>
            <Switch checked={saveToProfile} onCheckedChange={(v) => setSaveToProfile(!!v)} />
          </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Persist generated problems</div>
                <div className="text-sm text-gray-600">When enabled, AI-generated problems will be stored in local cache for later reuse. Default is off to avoid duplicates across modes.</div>
              </div>
              <Switch checked={persistGenerated} onCheckedChange={(v) => setPersistGenerated(!!v)} />
            </div>
          <div>
            <div className="font-medium">AI Status</div>
            <div className="text-sm text-gray-600">SDK: {aiStatus.sdkAvailable ? 'Available' : 'Unavailable'} • Endpoint: {aiStatus.endpoint || 'None'} • Fallbacks logged: {aiStatus.fallbackCount || 0}</div>
            <div className="mt-2">
              <Button variant="ghost" onClick={handleResetLogs}>Clear AI Logs</Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
