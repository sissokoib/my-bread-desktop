import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { DepensesComponent } from './depenses.component';

describe('DepensesComponent', () => {
  let component: DepensesComponent;
  let fixture: ComponentFixture<DepensesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepensesComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(DepensesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
