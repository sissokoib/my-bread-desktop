import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { TourneesComponent } from './tournees.component';

describe('TourneesComponent', () => {
  let component: TourneesComponent;
  let fixture: ComponentFixture<TourneesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TourneesComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(TourneesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
