import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ProduitsComponent } from './produits.component';

describe('ProduitsComponent', () => {
  let component: ProduitsComponent;
  let fixture: ComponentFixture<ProduitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProduitsComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProduitsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
