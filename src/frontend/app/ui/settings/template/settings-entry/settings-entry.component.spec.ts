import '../../../../../../common/config/public/Config';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {WebConfigClassBuilder} from 'typeconfig/web';
import {IWebConfigClassPrivate} from 'typeconfig/common';
import {BsModalService} from 'ngx-bootstrap/modal';
import {SettingsEntryComponent} from './settings-entry.component';
import {ConfigStyle, SettingsService} from '../../settings.service';
import {SearchQueryParserService} from '../../../gallery/search/search-query-parser.service';
import {WebConfig} from '../../../../../../common/config/private/WebConfig';
import {TAGS} from '../../../../../../common/config/public/ClientConfig';
import {RecursiveState, StatefulConfig} from '../RecursiveState';

// #1315: the client limits the input to the boundaries in the config metadata
describe('SettingsEntryComponent', () => {
  // the state of the sharing key length (unsignedInt, min: 8, max: 64), as the settings page gets it
  const sharingKeyLengthState = (): RecursiveState => {
    const wc = WebConfigClassBuilder.attachPrivateInterface(new WebConfig()) as IWebConfigClassPrivate<TAGS> & WebConfig;
    return (wc.Sharing as unknown as StatefulConfig).__state['sharingKeyLength'];
  };

  const setUp = (state: RecursiveState) => {
    TestBed.configureTestingModule({
      imports: [SettingsEntryComponent],
      providers: [
        {provide: SettingsService, useValue: {configStyle: signal(ConfigStyle.full), edits: signal(0), settings: signal({Environment: {isDocker: false}})}},
        {provide: SearchQueryParserService, useValue: {}},
        {provide: BsModalService, useValue: {}},
      ]
    });
    const fixture = TestBed.createComponent(SettingsEntryComponent);
    fixture.componentInstance.writeValue(state);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    return {component: fixture.componentInstance, input, fixture};
  };

  it('should render a number setting as a number input with the min and max of the config', () => {
    const state = sharingKeyLengthState();
    expect(state.min).toBe(8);
    expect(state.max).toBe(64);
    const {input} = setUp(state);
    expect(input.type).toBe('number');
    expect(input.min).toBe('8');
    expect(input.max).toBe('64');
  });

  it('should accept a value within the limits', () => {
    const state = sharingKeyLengthState();
    state.value = 32;
    const {component} = setUp(state);
    expect(component.validate()).toBeNull();
  });

  it('should not let the settings form accept a value out of the limits', () => {
    const state = sharingKeyLengthState();
    state.value = 200;
    const {component} = setUp(state);
    expect(component.validate()).toEqual({max: {max: 64, actual: 200}});
  });

  it('should not let the settings form accept a value below the limits', () => {
    const state = sharingKeyLengthState();
    state.value = 4;
    const {component} = setUp(state);
    expect(component.validate()).toEqual({min: {min: 8, actual: 4}});
  });

  it('should show the limits on the field when the typed value is out of them', async () => {
    const {input, fixture} = setUp(sharingKeyLengthState());
    const error = (): Element | null => (fixture.nativeElement as HTMLElement).querySelector('.text-danger');
    expect(error()).toBeNull();

    input.value = '200';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(error()!.textContent).toContain('The value must be between 8 and 64.');

    input.value = '16';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(error()).toBeNull();
  });
});
