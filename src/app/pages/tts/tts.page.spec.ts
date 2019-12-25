import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { TtsPage } from './tts.page';

describe('TtsPage', () => {
  let component: TtsPage;
  let fixture: ComponentFixture<TtsPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TtsPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(TtsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
