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
    return {component: fixture.componentInstance, input};
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

  // TODO #1315: validate() only checks that a value is set, so the settings form can be saved with an out-of-range number
  it.fails('should not let the settings form accept a value out of the limits', () => {
    const state = sharingKeyLengthState();
    state.value = 200;
    const {component} = setUp(state);
    expect(component.validate()).not.toBeNull();
  });
});
