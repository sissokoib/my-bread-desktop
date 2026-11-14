import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { PaiementsComponent } from './paiements.component';

describe('PaiementsComponent', () => {
  let component: PaiementsComponent;
  let fixture: ComponentFixture<PaiementsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaiementsComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(PaiementsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
