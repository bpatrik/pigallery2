import {Component, computed, inject} from '@angular/core';
import {NgIconComponent} from '@ng-icons/core';
import {Toast, ToastPlacement, ToastService, ToastSummary, ToastType} from './toast.service';
import {ToastCardComponent} from './toast-card.component';

// One card in a stack: a toast, or the summary of a collapsible group
export interface ToastEntry {
  key: string;
  toast?: Toast;
  group?: string;
  summary?: ToastSummary;
  expanded?: boolean;
}

@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.css'],
  imports: [ToastCardComponent, NgIconComponent]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  readonly PLACEMENTS: ToastPlacement[] = ['top-center', 'bottom-right'];

  readonly COLORS: Record<ToastType, string> = {
    success: 'success',
    error: 'danger',
    warning: 'warning',
    info: 'primary', // Bootstrap's info cyan is not used anywhere else in the app
    progress: 'primary'
  };

  readonly ICONS: Record<ToastType, string> = {
    success: 'ionCheckmarkCircle',
    error: 'ionAlertCircle',
    warning: 'ionWarningOutline',
    info: 'ionInformationCircleOutline',
    progress: 'ionCloudUploadOutline'
  };

  // The cards of each stack, starting at the corner of the screen
  readonly stacks = computed((): Record<ToastPlacement, ToastEntry[]> => {
    const toasts = this.toastService.toasts();
    this.toastService.expandedGroups(); // the stacks change when a group is toggled
    return {
      // newest on top
      'top-center': this.buildStack(toasts.filter((t) => t.placement === 'top-center').reverse(), false),
      // oldest at the bottom, the group summary below its toasts
      'bottom-right': this.buildStack(toasts.filter((t) => t.placement === 'bottom-right'), true)
    };
  });

  color(item: { type: ToastType, color?: string }): string {
    return item.color || this.COLORS[item.type];
  }

  icon(item: { type: ToastType, icon?: string }): string {
    return item.icon || this.ICONS[item.type];
  }

  onToastClick(toast: Toast): void {
    if (toast.closable) {
      this.toastService.dismiss(toast.id);
    }
  }

  // The cancel button sits on a clickable card, the click must not close or toggle it too
  onCancel(event: Event, cancel: () => void): void {
    event.stopPropagation();
    cancel();
  }

  onCloseGroup(event: Event, group: string): void {
    event.stopPropagation();
    this.toastService.dismissGroup(group);
  }

  private buildStack(toasts: Toast[], summaryFirst: boolean): ToastEntry[] {
    const entries: ToastEntry[] = [];
    const doneGroups = new Set<string>();
    for (const toast of toasts) {
      const group = toast.group && this.toastService.getGroup(toast.group);
      if (!group) {
        entries.push({key: 't' + toast.id, toast});
        continue;
      }
      if (doneGroups.has(toast.group)) {
        continue;
      }
      doneGroups.add(toast.group);
      // the whole group goes where its first toast is
      const members = toasts.filter((t) => t.group === toast.group);
      if (members.length <= group.collapseAfter) {
        entries.push(...members.map((t) => ({key: 't' + t.id, toast: t})));
        continue;
      }
      const expanded = this.toastService.isExpanded(toast.group);
      const visible = expanded ? members : members.slice(0, group.visibleWhenCollapsed);
      const hidden = expanded ? [] : members.slice(group.visibleWhenCollapsed);
      const summary: ToastEntry = {
        key: 'g' + toast.group,
        group: toast.group,
        summary: group.summary(members, hidden, expanded),
        expanded
      };
      const visibleEntries = visible.map((t) => ({key: 't' + t.id, toast: t}));
      entries.push(...(summaryFirst ? [summary, ...visibleEntries] : [...visibleEntries, summary]));
    }
    return entries;
  }
}
